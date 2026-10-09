import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import type { AuthenticatedRequest } from '../../infrastructure/auth/authenticated-request';

export const PERMISSIONS = [
  { key: 'account.read', name: 'Просмотр своего аккаунта', system: false },
  { key: 'account.update', name: 'Изменение своего профиля', system: false },
  { key: 'account.login.change', name: 'Смена своего логина', system: false },
  {
    key: 'account.password.change',
    name: 'Смена своего пароля',
    system: false,
  },
  {
    key: 'system.access.manage',
    name: 'Управление аккаунтами, ролями и правами',
    system: true,
  },
  { key: 'system.keycloak.manage', name: 'Настройка Keycloak', system: true },
] as const;

export type AdminPermission = (typeof PERMISSIONS)[number]['key'];
export type AdminPrincipal = AuthenticatedRequest['user'];

export function effectivePermissions(role: {
  key: string;
  permissions: string[];
}): string[] {
  if (role.key === 'OWNER')
    return PERMISSIONS.map((permission) => permission.key);
  if (role.key === 'ADMIN')
    return PERMISSIONS.filter((permission) => !permission.system).map(
      (permission) => permission.key,
    );
  return PERMISSIONS.filter(
    (permission) =>
      !permission.system && role.permissions.includes(permission.key),
  ).map((permission) => permission.key);
}

// Сериализует системные изменения, включая проверку последнего владельца.
// Всегда перед user locks; OIDC использует тот же lock для версии конфигурации.
export async function lockAdminSecurity(
  tx: Prisma.TransactionClient,
): Promise<void> {
  // PostgreSQL возвращает void; Prisma требует поддерживаемый тип колонки.
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(8742001)::text`;
}

export async function requireAdminPermission(
  tx: Prisma.TransactionClient,
  actor: AdminPrincipal,
  permission: AdminPermission,
) {
  await tx.$queryRaw`SELECT id FROM "AdminUser" WHERE id = ${actor.id}::uuid FOR UPDATE`;
  const now = new Date();
  const session = await tx.adminSession.findFirst({
    where: {
      id: actor.sessionId,
      userId: actor.id,
      revokedAt: null,
      expiresAt: { gt: now },
      user: { isActive: true },
      OR: [{ identityId: null }, { identity: { revokedAt: null } }],
    },
    include: { user: { include: { accessRole: true } } },
  });
  if (!session || actor.accessExpiresAt <= now.getTime())
    throw new UnauthorizedException('Session is inactive');
  if (!effectivePermissions(session.user.accessRole).includes(permission))
    throw new ForbiddenException('Недостаточно прав.');
  return session.user;
}
