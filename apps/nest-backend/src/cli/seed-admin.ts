import 'reflect-metadata';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AdminUsersService } from '../modules/admin-users/admin-users.service';

async function main(): Promise<void> {
  const production = process.env.NODE_ENV === 'production';
  const password =
    process.env.BOOTSTRAP_ADMIN_PASSWORD ?? (production ? undefined : 'admin');
  if (password === undefined) {
    throw new BadRequestException(
      'BOOTSTRAP_ADMIN_PASSWORD is required in production.',
    );
  }

  const developmentPassword = !production && password === 'admin';
  const passwordLength = Array.from(password).length;
  if (passwordLength > 128 || (passwordLength < 12 && !developmentPassword)) {
    throw new BadRequestException(
      'BOOTSTRAP_ADMIN_PASSWORD must contain between 12 and 128 characters. The development default is allowed only outside production.',
    );
  }

  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const admins = new AdminUsersService(prisma);
    await admins.onModuleInit();
    let created = false;

    if (!(await admins.findByLogin('admin'))) {
      try {
        await admins.create('admin', password, {
          allowDevelopmentPassword: developmentPassword,
        });
        created = true;
      } catch (error) {
        // Параллельное заполнение БД могло создать учётную запись; не заменяем хеш её пароля.
        if (
          !(error instanceof ConflictException) ||
          !(await admins.findByLogin('admin'))
        ) {
          throw error;
        }
      }
    }

    // Проверяем существующую учётную запись повторно: параллельное заполнение БД
    // могло создать её после инициализации.
    if (!created) await admins.onModuleInit();

    console.info(
      created
        ? 'Bootstrap administrator created.'
        : 'Bootstrap administrator already exists; credentials were not changed.',
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof BadRequestException || error instanceof ConflictException
      ? error.message
      : 'Admin seed failed. Check database configuration, connectivity, and migrations.',
  );
  process.exitCode = 1;
});
