import 'reflect-metadata';
import { PrismaService } from '../infrastructure/prisma/prisma.service';

async function main(): Promise<void> {
  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const now = new Date();
    // Каскадно удаляем историю токенов только вместе с истёкшей сессией.
    const [client, admin] = await prisma.$transaction([
      prisma.clientSession.deleteMany({ where: { expiresAt: { lte: now } } }),
      prisma.adminSession.deleteMany({ where: { expiresAt: { lte: now } } }),
    ]);
    console.info(
      `Expired sessions deleted: client=${client.count}, admin=${admin.count}.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch(() => {
  console.error(
    'Session cleanup failed. Check database configuration, connectivity, and migrations.',
  );
  process.exitCode = 1;
});
