import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import {
  AdminRole,
  Prisma,
  type AdminUser,
} from '../../generated/prisma/client';
import type { AuthenticatedRequest } from '../../infrastructure/auth/authenticated-request';
import {
  hashPassword,
  verifyPassword,
} from '../../infrastructure/auth/password';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AdminUserDto } from './dto/admin-user.dto';
import { ChangeAdminPasswordDto } from './dto/change-admin-password.dto';

const adminUserSelect = {
  id: true,
  login: true,
  isActive: true,
  role: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.AdminUserSelect;

@Injectable()
export class AdminUsersService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    if (process.env.NODE_ENV !== 'production') return;

    const admin = await this.prisma.adminUser.findUnique({
      where: { login: 'admin' },
      select: { passwordHash: true },
    });

    if (admin && (await verifyPassword(admin.passwordHash, 'admin'))) {
      throw new BadRequestException(
        'Production startup is blocked: replace the stored bootstrap administrator development password.',
      );
    }
  }

  findByLogin(login: string): Promise<AdminUser | null> {
    return this.prisma.adminUser.findUnique({
      where: { login: login.toLowerCase() },
    });
  }

  async getProfile(id: string): Promise<AdminUserDto> {
    const admin = await this.prisma.adminUser.findUnique({
      where: { id },
      select: adminUserSelect,
    });

    if (!admin) throw new NotFoundException('Administrator not found.');
    return admin;
  }

  async changePassword(
    actor: AuthenticatedRequest['user'],
    dto: ChangeAdminPasswordDto,
  ): Promise<void> {
    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.$transaction(
      async (tx) => {
        // Общий порядок с login/refresh/logout: user, затем session.
        await tx.$queryRaw`
          SELECT id FROM "AdminUser" WHERE id = ${actor.id}::uuid FOR UPDATE
        `;
        const now = new Date();
        const session = await tx.adminSession.findFirst({
          where: {
            id: actor.sessionId,
            userId: actor.id,
            revokedAt: null,
            expiresAt: { gt: now },
            user: {
              isActive: true,
              role: { in: [AdminRole.OWNER, AdminRole.SUPPORT] },
            },
          },
          select: { user: { select: { passwordHash: true } } },
        });
        // Guard мог пропустить запрос до отзыва; повторяем проверку под lock.
        if (!session || actor.accessExpiresAt <= now.getTime()) {
          throw new UnauthorizedException('Session is inactive');
        }
        if (
          !(await verifyPassword(
            session.user.passwordHash,
            dto.currentPassword,
          ))
        ) {
          throw new UnauthorizedException('Invalid current password');
        }
        await tx.adminUser.update({
          where: { id: actor.id },
          data: { passwordHash },
          select: { id: true },
        });
        await tx.adminSession.updateMany({
          where: { userId: actor.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      },
      { timeout: 10000 },
    );
  }

  // Создание доступно только CLI/bootstrap; HTTP-регистрации администраторов нет.
  async create(
    login: string,
    password: string,
    options: { allowDevelopmentPassword?: boolean; role?: AdminRole } = {},
  ): Promise<AdminUserDto> {
    if (!/^[a-zA-Z0-9_.-]{3,64}$/.test(login)) {
      throw new BadRequestException(
        'Admin login must contain 3 to 64 letters, digits, underscores, dots, or hyphens.',
      );
    }

    const normalizedLogin = login.toLowerCase();
    const production = process.env.NODE_ENV === 'production';
    if (options.allowDevelopmentPassword === true && production) {
      throw new BadRequestException(
        'Development passwords are not allowed in production.',
      );
    }

    const developmentPassword =
      options.allowDevelopmentPassword === true &&
      !production &&
      normalizedLogin === 'admin' &&
      password === 'admin';
    const passwordLength = Array.from(password).length;
    if (passwordLength > 128 || (passwordLength < 12 && !developmentPassword)) {
      throw new BadRequestException(
        'Admin password must contain between 12 and 128 characters.',
      );
    }

    const passwordHash = await hashPassword(password);
    try {
      return await this.prisma.adminUser.create({
        data: {
          login: normalizedLogin,
          passwordHash,
          role: options.role ?? AdminRole.OWNER,
        },
        select: adminUserSelect,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Admin login is already in use.');
      }
      throw error;
    }
  }
}
