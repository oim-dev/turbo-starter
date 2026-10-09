import type {
  AdminIdentity,
  AdminUser,
  Prisma,
} from '../../generated/prisma/client';

// Порядок везде одинаков: user → identity → OIDC transaction → completion/session.
// После ожидания lock перечитываем значения, не используем предварительный snapshot.
export async function lockAdminIdentity(
  tx: Prisma.TransactionClient,
  userId: string,
  identityId: string,
): Promise<{ user: AdminUser; identity: AdminIdentity } | null> {
  await tx.$queryRaw`SELECT id FROM "AdminUser" WHERE id = ${userId}::uuid FOR UPDATE`;
  await tx.$queryRaw`SELECT id FROM "AdminIdentity" WHERE id = ${identityId}::uuid FOR UPDATE`;
  const user = await tx.adminUser.findUnique({ where: { id: userId } });
  const identity = await tx.adminIdentity.findUnique({
    where: { id: identityId },
  });
  if (
    !user?.isActive ||
    !identity ||
    identity.userId !== user.id ||
    identity.revokedAt !== null
  )
    return null;
  return { user, identity };
}
