import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { hashPassword } from '../../infrastructure/auth/password';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { lockAdminSecurity } from '../admin-access/admin-permissions';

@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap(): Promise<void> {
    const created = await this.prisma.$transaction(
      async (tx) => {
        await lockAdminSecurity(tx);
        // Переименование владельца не восстанавливает admin/admin при рестарте.
        if ((await tx.adminUser.count()) !== 0) return false;
        const password = process.env.BOOTSTRAP_ADMIN_PASSWORD ?? 'admin';
        const length = Array.from(password).length;
        if (password !== 'admin' && (length < 12 || length > 128)) {
          throw Object.assign(new Error('Invalid bootstrap password length.'), {
            code: 'INVALID_BOOTSTRAP_PASSWORD',
          });
        }
        await tx.adminUser.create({
          data: {
            login: 'admin',
            passwordHash: await hashPassword(password),
            role: 'OWNER',
          },
        });
        return true;
      },
      { timeout: 10000 },
    );
    if (created) this.logger.log('Initial owner account created.');
  }
}
