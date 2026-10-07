import 'reflect-metadata';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';
import { AdminRole } from '../generated/prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { AdminUsersService } from '../modules/admin-users/admin-users.service';

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const login = args[0];
  const role = args[1] ?? AdminRole.OWNER;
  if (
    !login ||
    args.length > 2 ||
    (role !== AdminRole.OWNER && role !== AdminRole.SUPPORT)
  ) {
    throw new BadRequestException(
      'Usage: admin:create <login> [OWNER|SUPPORT]. Default role: OWNER. The password is requested interactively.',
    );
  }
  if (!process.stdin.isTTY) {
    throw new BadRequestException(
      'Admin creation requires an interactive TTY for hidden password input. Piped input is not supported.',
    );
  }

  const output = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const input = createInterface({
    input: process.stdin,
    output,
    terminal: true,
    historySize: 0,
  });
  const abort = new AbortController();
  input.on('SIGINT', () => abort.abort());
  input.on('close', () => abort.abort());

  let password: string;
  try {
    process.stderr.write('Password: ');
    password = await input.question('', { signal: abort.signal });
    process.stderr.write('\nConfirm password: ');
    const confirmation = await input.question('', { signal: abort.signal });
    if (password !== confirmation) {
      throw new BadRequestException('Passwords do not match.');
    }
  } catch (error) {
    if (abort.signal.aborted) {
      throw new BadRequestException('Password input was cancelled.');
    }
    throw error;
  } finally {
    input.close();
    output.destroy();
    process.stderr.write('\n');
  }

  const prisma = new PrismaService();
  try {
    await prisma.$connect();
    const admins = new AdminUsersService(prisma);
    await admins.onModuleInit();
    const admin = await admins.create(login, password, { role });
    console.info(
      `Administrator "${admin.login}" created (${admin.id}, ${admin.role}).`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof BadRequestException || error instanceof ConflictException
      ? error.message
      : 'Admin creation failed. Check database configuration, connectivity, and migrations.',
  );
  process.exitCode = 1;
});
