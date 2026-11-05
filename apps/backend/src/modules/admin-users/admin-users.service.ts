import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma, type AdminUser } from '../../generated/prisma/client';
import type { AuthenticatedRequest } from '../../infrastructure/auth/authenticated-request';
import {
  hashPassword,
  verifyPassword,
} from '../../infrastructure/auth/password';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AdminUserDto } from './dto/admin-user.dto';
import { ChangeAdminPasswordDto } from './dto/change-admin-password.dto';
import { invalidateAdminAuthentication } from './admin-authentication';
import {
  effectivePermissions,
  requireAdminPermission,
} from '../admin-access/admin-permissions';
import {
  ChangeAdminLoginDto,
  UpdateAdminProfileDto,
} from './dto/update-admin-profile.dto';

const adminUserSelect = {
  id: true,
  login: true,
  isActive: true,
  role: true,
  createdAt: true,
  updatedAt: true,
  passwordHash: true,
  name: true,
  accessRole: true,
} satisfies Prisma.AdminUserSelect;

function profile(
  admin: Prisma.AdminUserGetPayload<{ select: typeof adminUserSelect }>,
): AdminUserDto {
  const { passwordHash, accessRole, ...data } = admin;
  return {
    ...data,
    roleName: accessRole.name,
    permissions: effectivePermissions(accessRole),
    hasLocalPassword: passwordHash !== null,
  };
}

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

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
    return profile(admin);
  }

  async changePassword(
    actor: AuthenticatedRequest['user'],
    dto: ChangeAdminPasswordDto,
  ): Promise<void> {
    const passwordHash = await hashPassword(dto.newPassword);
    await this.prisma.$transaction(
      async (tx) => {
        const user = await requireAdminPermission(
          tx,
          actor,
          'account.password.change',
        );
        if (user.passwordHash === null) {
          throw new ForbiddenException({
            code: 'LOCAL_PASSWORD_UNAVAILABLE',
            message: 'Local password is not enabled for this administrator.',
          });
        }
        if (!(await verifyPassword(user.passwordHash, dto.currentPassword))) {
          throw new UnauthorizedException({
            code: 'CURRENT_PASSWORD_INVALID',
            message: 'Invalid current password',
          });
        }
        await tx.adminUser.update({
          where: { id: actor.id },
          data: { passwordHash },
          select: { id: true },
        });
        await invalidateAdminAuthentication(tx, actor.id);
      },
      { timeout: 10000 },
    );
  }

  async updateProfile(
    actor: AuthenticatedRequest['user'],
    dto: UpdateAdminProfileDto,
  ): Promise<AdminUserDto> {
    return this.prisma.$transaction(async (tx) => {
      await requireAdminPermission(tx, actor, 'account.update');
      return profile(
        await tx.adminUser.update({
          where: { id: actor.id },
          data: { name: dto.name.trim() },
          select: adminUserSelect,
        }),
      );
    });
  }

  async changeLogin(
    actor: AuthenticatedRequest['user'],
    dto: ChangeAdminLoginDto,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(
        async (tx) => {
          const user = await requireAdminPermission(
            tx,
            actor,
            'account.login.change',
          );
          // У SSO-only аккаунта подтверждением служит действующая собственная сессия.
          if (
            user.passwordHash &&
            !(await verifyPassword(
              user.passwordHash,
              dto.currentPassword ?? '',
            ))
          ) {
            throw new UnauthorizedException({
              code: 'CURRENT_PASSWORD_INVALID',
              message: 'Invalid current password',
            });
          }
          await tx.adminUser.update({
            where: { id: actor.id },
            data: { login: dto.login.toLowerCase() },
          });
          await invalidateAdminAuthentication(tx, actor.id);
        },
        { timeout: 10000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('Логин уже занят.');
      throw error;
    }
  }
}
