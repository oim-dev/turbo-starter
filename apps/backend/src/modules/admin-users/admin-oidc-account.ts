import { randomUUID } from 'node:crypto';
import type {
  AdminIdentity,
  AdminUser,
  Prisma,
} from '../../generated/prisma/client';
import { lockAdminIdentity } from './admin-identity-lock';

// Вызывается после проверки OIDC под общей lockAdminSecurity в транзакции callback.
// Отозванная identity остаётся занятой и не создаётся заново.
export async function resolveAdminOidcAccount(
  tx: Prisma.TransactionClient,
  verified: { issuer: string; subject: string; name: string },
): Promise<{ user: AdminUser; identity: AdminIdentity } | null> {
  const existing = await tx.adminIdentity.findUnique({
    where: {
      issuer_subject: { issuer: verified.issuer, subject: verified.subject },
    },
  });
  if (existing) return lockAdminIdentity(tx, existing.userId, existing.id);

  const user = await tx.adminUser.create({
    data: {
      login: `kc-${randomUUID()}`,
      name: verified.name,
      role: 'USER',
      isActive: false,
      passwordHash: null,
      // Это граница отзыва, а не дата регистрации. Первый flow начат до
      // создания аккаунта; последующие изменения credentials установят часы БД.
      authValidAfter: new Date(0),
    },
  });
  const identity = await tx.adminIdentity.create({
    data: {
      userId: user.id,
      issuer: verified.issuer,
      subject: verified.subject,
    },
  });
  await tx.adminSecurityAudit.create({
    data: {
      actorId: user.id,
      action: 'account.keycloak.create',
      target: user.id,
    },
  });
  return { user, identity };
}
