import type { Prisma } from '../../generated/prisma/client';

// Вызывается только под блокировкой строки AdminUser. Инвалидирует как сессии,
// так и результат ещё не завершённого OIDC-входа, включая A → B → A.
export async function invalidateAdminAuthentication(
  tx: Prisma.TransactionClient,
  userId: string,
): Promise<void> {
  // Общие часы БД для границы ранее начатых flow на нескольких API-инстансах.
  const [clock] = await tx.$queryRaw<
    Array<{ now: Date }>
  >`SELECT clock_timestamp() AS now`;
  if (!clock) throw new Error('Database clock is unavailable');
  const now = clock.now;
  await tx.adminUser.update({
    where: { id: userId },
    data: { authVersion: { increment: 1 }, authValidAfter: now },
  });
  await tx.adminSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now },
  });
}
