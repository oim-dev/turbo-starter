import { randomInt } from 'node:crypto';
import type { ImageRealm, Prisma } from '../../generated/prisma/client';

const alphabet =
  '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const publicId = /^[0-9A-Za-z]{8}$/;

export function newImagePublicId(): string {
  return Array.from({ length: 8 }, () => alphabet[randomInt(62)]).join('');
}

export function imageHashScope(image: {
  ownerRealm: ImageRealm;
  ownerId: string;
}): string {
  return image.ownerRealm === 'admin' ? 'admin' : `client:${image.ownerId}`;
}

export function imageSearchId(search: string): string | null {
  const candidate =
    /(?:^|\/)media\/images\/([^/?#]+)(?:\/|$)/.exec(search)?.[1] ?? search;
  if (uuid.test(candidate)) return candidate.toLowerCase();
  return publicId.test(candidate) ? candidate : null;
}

// ON CONFLICT ждёт победивший COMMIT. Следующий SELECT при READ COMMITTED
// видит ровно один claim; конфликт не прерывает текущую транзакцию.
export async function claimImageHash(
  tx: Prisma.TransactionClient,
  scope: string,
  sha256: string,
  imageId: string,
): Promise<string> {
  await tx.$executeRaw`INSERT INTO "ImageHashClaim" (scope, sha256, "imageId")
    VALUES (${scope}, ${sha256}, ${imageId}::uuid)
    ON CONFLICT (scope, sha256) DO NOTHING`;
  const claim = await tx.imageHashClaim.findUniqueOrThrow({
    where: { scope_sha256: { scope, sha256 } },
  });
  return claim.imageId;
}

export function manifestFamily(
  variants: { preset: string }[],
): string | undefined {
  return ['original', 'square', 'landscape'].find((family) =>
    variants.some((variant) => variant.preset === family),
  );
}
