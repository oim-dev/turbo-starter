import 'reflect-metadata';
import { ImageConfig } from './infrastructure/config/image-config';
import { PrismaService } from './infrastructure/prisma/prisma.service';
import { ImageStorage } from './infrastructure/storage/image-storage.service';
import { ImageProcessingError } from './modules/images/image-error';
import {
  claimImageHash,
  imageHashScope,
} from './modules/images/image-identity';
import { ImageOriginalVerifier } from './modules/images/image-original-verifier';

// Явный административный CLI; не подключён к lifecycle приложений/worker.
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help')) {
    console.info(
      'images:backfill-hashes --apply [--batch-size=50] [--limit=1000]\nПроверяет сохранённые оригиналы ready/failed, объединяет записи, сохраняя legacy URL и байты. Повторный запуск продолжает по originalSha256 IS NULL.',
    );
    return;
  }
  if (
    !args.includes('--apply') ||
    args.some((arg) => !/^(--apply|--batch-size=\d+|--limit=\d+)$/.test(arg))
  )
    throw new Error('Нужен явный --apply; справка: --help.');
  const option = (name: string, fallback: number) => {
    const value = Number(
      args.find((arg) => arg.startsWith(`--${name}=`))?.split('=')[1] ??
        fallback,
    );
    if (!Number.isSafeInteger(value) || value < 1)
      throw new Error(`Некорректный --${name}.`);
    return value;
  };
  const batchSize = Math.min(500, option('batch-size', 50));
  const limit = option('limit', Number.MAX_SAFE_INTEGER);
  const prisma = new PrismaService();
  const config = new ImageConfig();
  const verifier = new ImageOriginalVerifier(new ImageStorage(config), config);
  let scanned = 0;
  let verified = 0;
  let aliases = 0;
  let errors = 0;
  try {
    await prisma.$connect();
    // Готовые наборы первыми получают claims. Никакой перегенерации вариантов.
    for (const status of ['ready', 'failed'] as const) {
      let after: string | undefined;
      while (scanned < limit) {
        const images = await prisma.image.findMany({
          where: {
            status,
            originalSha256: null,
            canonicalId: null,
            originalKey: { not: null },
            ...(after ? { id: { gt: after } } : {}),
          },
          orderBy: { id: 'asc' },
          take: Math.min(batchSize, limit - scanned),
        });
        if (!images.length) break;
        for (const image of images) {
          after = image.id;
          scanned++;
          if (!image.originalKey || !image.originalEtag) continue;
          try {
            const sha256 = await verifier.verify(
              {
                key: image.originalKey,
                etag: image.originalEtag,
                versionId: image.originalVersionId,
              },
              image,
            );
            const result = await prisma.$transaction(
              async (tx) => {
                // Порядок как в retry/worker: job, затем Image. Сеть уже завершена.
                await tx.$queryRaw`SELECT id FROM "ImageJob" WHERE "imageId" = ${image.id}::uuid FOR UPDATE`;
                await tx.$queryRaw`SELECT id FROM "Image" WHERE id = ${image.id}::uuid FOR UPDATE`;
                const current = await tx.image.findUniqueOrThrow({
                  where: { id: image.id },
                  include: { job: true },
                });
                if (
                  current.originalSha256 ||
                  current.canonicalId ||
                  !['ready', 'failed'].includes(current.status) ||
                  (current.job &&
                    !['ready', 'failed'].includes(current.job.status)) ||
                  current.originalKey !== image.originalKey ||
                  current.originalEtag !== image.originalEtag ||
                  current.originalVersionId !== image.originalVersionId
                )
                  return null;
                const canonicalId = await claimImageHash(
                  tx,
                  imageHashScope(current),
                  sha256,
                  image.id,
                );
                await tx.image.update({
                  where: { id: image.id },
                  data: {
                    originalSha256: sha256,
                    canonicalId: canonicalId === image.id ? null : canonicalId,
                  },
                });
                return canonicalId !== image.id;
              },
              { isolationLevel: 'ReadCommitted' },
            );
            if (result !== null) {
              verified++;
              if (result) aliases++;
              console.info(
                JSON.stringify({
                  id: image.id,
                  result: result ? 'alias' : 'canonical',
                }),
              );
            }
          } catch (error) {
            errors++;
            // Ошибки SDK могут содержать credentials/presigned URL.
            console.error(
              JSON.stringify({
                id: image.id,
                error:
                  error instanceof ImageProcessingError
                    ? error.code
                    : 'BACKFILL_UNAVAILABLE',
              }),
            );
          }
        }
      }
    }
    const pending = await prisma.image.count({
      where: { originalSha256: null, originalKey: { not: null } },
    });
    console.info(
      JSON.stringify({ scanned, verified, aliases, errors, pending }),
    );
    if (errors) process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error && /^(Нужен|Некорректный)/.test(error.message)
      ? error.message
      : 'Backfill прерван. Проверьте окружение и доступность БД/хранилища; повторный запуск безопасен.',
  );
  process.exitCode = 1;
});
