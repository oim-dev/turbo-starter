import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  type AdminUser,
  type AdminIdentity,
} from '../../generated/prisma/client';
import { hashPassword } from '../../infrastructure/auth/password';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { validateOidcUrl } from '../../infrastructure/config/admin-keycloak-config';
import { invalidateAdminAuthentication } from '../admin-users/admin-authentication';
import {
  effectivePermissions,
  lockAdminSecurity,
  PERMISSIONS,
  requireAdminPermission,
  type AdminPrincipal,
} from './admin-permissions';
import {
  AdminAccessRoleDto,
  AdminAccountDto,
  CreateAdminAccountDto,
  CreateAdminRoleDto,
  UpdateAdminAccountDto,
  UpdateAdminRoleDto,
  BindAdminIdentityDto,
} from './admin-access.dto';

const accountInclude = {
  identities: { where: { revokedAt: null } },
} satisfies Prisma.AdminUserInclude;

function account(
  user: AdminUser & { identities: AdminIdentity[] },
): AdminAccountDto {
  return {
    id: user.id,
    login: user.login,
    name: user.name,
    role: user.role,
    isActive: user.isActive,
    hasLocalPassword: user.passwordHash !== null,
    version: user.authVersion,
    identities: user.identities.map((identity) => ({
      id: identity.id,
      issuer: identity.issuer,
      subject: identity.subject,
    })),
  };
}

@Injectable()
export class AdminAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async roles(): Promise<AdminAccessRoleDto[]> {
    return (
      await this.prisma.adminAccessRole.findMany({
        orderBy: [{ isBuiltin: 'desc' }, { key: 'asc' }],
      })
    ).map((role) => ({ ...role, permissions: effectivePermissions(role) }));
  }

  async accounts(): Promise<AdminAccountDto[]> {
    return (
      await this.prisma.adminUser.findMany({
        orderBy: { login: 'asc' },
        include: accountInclude,
      })
    ).map(account);
  }

  private validateRole(dto: { name: string; permissions: string[] }): void {
    const allowed = PERMISSIONS.filter((permission) => !permission.system).map(
      (permission) => permission.key as string,
    );
    if (
      !dto.name.trim() ||
      !dto.permissions.includes('account.read') ||
      dto.permissions.some((permission) => !allowed.includes(permission))
    ) {
      throw new BadRequestException(
        'Нужны название и account.read; системные и неизвестные permissions назначать нельзя.',
      );
    }
  }

  private async write<T>(
    actor: AdminPrincipal,
    action: string,
    target: string,
    work: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          await lockAdminSecurity(tx);
          await requireAdminPermission(tx, actor, 'system.access.manage');
          const result = await work(tx);
          await tx.adminSecurityAudit.create({
            data: { actorId: actor.id, action, target },
          });
          return result;
        },
        { timeout: 10000 },
      );
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        ['P2002', 'P2003'].includes(error.code)
      )
        throw new ConflictException('Запись уже существует или используется.');
      throw error;
    }
  }

  createRole(
    actor: AdminPrincipal,
    dto: CreateAdminRoleDto,
  ): Promise<AdminAccessRoleDto> {
    this.validateRole(dto);
    return this.write(actor, 'role.create', dto.key, (tx) =>
      tx.adminAccessRole.create({ data: { ...dto, name: dto.name.trim() } }),
    );
  }

  updateRole(
    actor: AdminPrincipal,
    key: string,
    dto: UpdateAdminRoleDto,
  ): Promise<AdminAccessRoleDto> {
    this.validateRole(dto);
    return this.write(actor, 'role.update', key, async (tx) => {
      const role = await tx.adminAccessRole.findUnique({ where: { key } });
      if (!role) throw new NotFoundException('Роль не найдена.');
      if (role.isBuiltin)
        throw new BadRequestException(
          'Встроенные роли неизменяемы. Создайте дополнительную роль.',
        );
      if (role.version !== dto.version)
        throw new ConflictException(
          'Роль изменена другим запросом. Обновите данные.',
        );
      const users = await tx.adminUser.findMany({
        where: { role: key },
        orderBy: { id: 'asc' },
        select: { id: true },
      });
      for (const user of users) {
        await tx.$queryRaw`SELECT id FROM "AdminUser" WHERE id = ${user.id}::uuid FOR UPDATE`;
        await invalidateAdminAuthentication(tx, user.id);
      }
      return tx.adminAccessRole.update({
        where: { key },
        data: {
          name: dto.name.trim(),
          permissions: dto.permissions,
          version: { increment: 1 },
        },
      });
    });
  }

  deleteRole(actor: AdminPrincipal, key: string): Promise<void> {
    return this.write(actor, 'role.delete', key, async (tx) => {
      const role = await tx.adminAccessRole.findUnique({
        where: { key },
        include: { _count: { select: { users: true } } },
      });
      if (!role) throw new NotFoundException('Роль не найдена.');
      if (role.isBuiltin || role._count.users !== 0)
        throw new ConflictException(
          'Нельзя удалить встроенную или назначенную роль.',
        );
      await tx.adminAccessRole.delete({ where: { key } });
    });
  }

  async createAccount(
    actor: AdminPrincipal,
    dto: CreateAdminAccountDto,
  ): Promise<AdminAccountDto> {
    const passwordHash = await hashPassword(dto.password);
    return this.write(
      actor,
      'account.create',
      dto.login.toLowerCase(),
      async (tx) => {
        if (
          !(await tx.adminAccessRole.findUnique({ where: { key: dto.role } }))
        )
          throw new BadRequestException('Неизвестная роль.');
        return account(
          await tx.adminUser.create({
            include: accountInclude,
            data: {
              login: dto.login.toLowerCase(),
              name: dto.name?.trim() ?? '',
              role: dto.role,
              passwordHash,
            },
          }),
        );
      },
    );
  }

  updateAccount(
    actor: AdminPrincipal,
    id: string,
    dto: UpdateAdminAccountDto,
  ): Promise<AdminAccountDto> {
    return this.write(actor, 'account.access.update', id, async (tx) => {
      await tx.$queryRaw`SELECT id FROM "AdminUser" WHERE id = ${id}::uuid FOR UPDATE`;
      const user = await tx.adminUser.findUnique({ where: { id } });
      if (!user) throw new NotFoundException('Аккаунт не найден.');
      if (
        dto.isActive &&
        user.passwordHash === null &&
        (await tx.adminIdentity.count({
          where: { userId: id, revokedAt: null },
        })) === 0
      ) {
        throw new BadRequestException(
          'Активному аккаунту нужен хотя бы один способ входа.',
        );
      }
      if (user.authVersion !== dto.version)
        throw new ConflictException('Аккаунт изменён. Обновите данные.');
      if (!(await tx.adminAccessRole.findUnique({ where: { key: dto.role } })))
        throw new BadRequestException('Неизвестная роль.');
      if (
        user.isActive &&
        user.role === 'OWNER' &&
        (!dto.isActive || dto.role !== 'OWNER') &&
        (await tx.adminUser.count({
          where: { role: 'OWNER', isActive: true },
        })) <= 1
      )
        throw new ConflictException(
          'Нельзя отключить или понизить последнего владельца.',
        );
      await tx.adminUser.update({
        where: { id },
        data: { role: dto.role, isActive: dto.isActive },
      });
      await invalidateAdminAuthentication(tx, id);
      return account(
        await tx.adminUser.findUniqueOrThrow({
          where: { id },
          include: accountInclude,
        }),
      );
    });
  }

  private async lockAccount(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<AdminUser> {
    await tx.$queryRaw`SELECT id FROM "AdminUser" WHERE id = ${id}::uuid FOR UPDATE`;
    const user = await tx.adminUser.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Аккаунт не найден.');
    return user;
  }

  bindIdentity(
    actor: AdminPrincipal,
    id: string,
    dto: BindAdminIdentityDto,
  ): Promise<void> {
    try {
      validateOidcUrl(dto.issuer, 'issuer');
      if (dto.issuer.includes('/.well-known/') || /\p{Cc}/u.test(dto.subject))
        throw new Error('Invalid identity');
    } catch {
      throw new BadRequestException(
        'Нужны корректный issuer realm и точный sub пользователя.',
      );
    }
    return this.write(actor, 'account.identity.bind', id, async (tx) => {
      await this.lockAccount(tx, id);
      const identity = await tx.adminIdentity.findUnique({
        where: { issuer_subject: dto },
      });
      if (identity && identity.userId !== id)
        throw new ConflictException(
          'Identity принадлежит другому аккаунту. Переназначение запрещено.',
        );
      if (identity?.revokedAt === null) return;
      if (identity)
        await tx.adminIdentity.update({
          where: { id: identity.id },
          data: { revokedAt: null },
        });
      else
        await tx.adminIdentity.create({
          data: { userId: id, issuer: dto.issuer, subject: dto.subject },
        });
      await invalidateAdminAuthentication(tx, id);
    });
  }

  unbindIdentity(
    actor: AdminPrincipal,
    id: string,
    identityId: string,
  ): Promise<void> {
    return this.write(actor, 'account.identity.unbind', id, async (tx) => {
      const user = await this.lockAccount(tx, id);
      const identity = await tx.adminIdentity.findUnique({
        where: { id: identityId },
      });
      if (!identity || identity.userId !== id)
        throw new NotFoundException('Привязка не найдена.');
      if (identity.revokedAt !== null) return;
      if (
        user.isActive &&
        user.passwordHash === null &&
        (await tx.adminIdentity.count({
          where: { userId: id, revokedAt: null, id: { not: identityId } },
        })) === 0
      ) {
        throw new BadRequestException(
          'Нельзя удалить последний способ входа активного аккаунта.',
        );
      }
      await tx.adminIdentity.update({
        where: { id: identityId },
        data: { revokedAt: new Date() },
      });
      await invalidateAdminAuthentication(tx, id);
    });
  }

  disableLocalPassword(actor: AdminPrincipal, id: string): Promise<void> {
    return this.write(
      actor,
      'account.local-password.disable',
      id,
      async (tx) => {
        const user = await this.lockAccount(tx, id);
        if (user.passwordHash === null) return;
        if (
          user.isActive &&
          (await tx.adminIdentity.count({
            where: { userId: id, revokedAt: null },
          })) === 0
        ) {
          throw new BadRequestException(
            'Сначала привяжите Keycloak: активному аккаунту нужен способ входа.',
          );
        }
        await tx.adminUser.update({
          where: { id },
          data: { passwordHash: null },
        });
        await invalidateAdminAuthentication(tx, id);
      },
    );
  }

  revokeSessions(actor: AdminPrincipal, id: string): Promise<void> {
    return this.write(actor, 'account.sessions.revoke', id, async (tx) => {
      await this.lockAccount(tx, id);
      await invalidateAdminAuthentication(tx, id);
    });
  }
}
