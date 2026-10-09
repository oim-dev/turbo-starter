import { backendAdminApi } from 'infra/backend-admin-api'
import { classifyAccessError } from '../errors/access.error'
import type { ManagedIdentity } from '../types/access.type'

/**
 * Привязывает точную внешнюю личность к существующему аккаунту.
 */
export const bindManagedIdentity = async (accountId: string, identity: Pick<ManagedIdentity, 'issuer' | 'subject'>): Promise<void> => {
  try {
    await backendAdminApi.access.adminIdentityBind({ id: accountId }, { issuer: identity.issuer, subject: identity.subject })
  } catch (error) { throw classifyAccessError(error) }
}

/**
 * Отзывает внешнюю привязку и прежние сессии аккаунта.
 */
export const unbindManagedIdentity = async (accountId: string, identityId: string): Promise<void> => {
  try { await backendAdminApi.access.adminIdentityUnbind({ id: accountId, identityId }) } catch (error) { throw classifyAccessError(error) }
}

/**
 * Отключает локальный пароль при наличии другого способа входа.
 */
export const disableManagedPassword = async (accountId: string): Promise<void> => {
  try { await backendAdminApi.access.adminLocalPasswordDisable({ id: accountId }) } catch (error) { throw classifyAccessError(error) }
}

/**
 * Завершает все сессии аккаунта и отменяет незавершённые входы.
 */
export const revokeManagedSessions = async (accountId: string): Promise<void> => {
  try { await backendAdminApi.access.adminSessionsRevoke({ id: accountId }) } catch (error) { throw classifyAccessError(error) }
}
