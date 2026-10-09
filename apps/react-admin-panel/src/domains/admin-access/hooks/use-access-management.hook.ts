import useSWR from 'swr'
import type { SWRResponse } from 'swr'
import { useGetCurrentUser } from 'domains/auth'
import { createManagedAccount, deleteAccessRole, getAccessData, saveAccessRole, updateManagedAccount } from '../adapters/access.adapter'
import { bindManagedIdentity, unbindManagedIdentity, disableManagedPassword, revokeManagedSessions } from '../adapters/account-security.adapter'
import type { AccessError } from '../errors/access.error'
import type { AccessData } from '../types/access.type'

/**
 * Данные доступа и действия с синхронизацией кеша.
 */
type AccessManagement = SWRResponse<AccessData, AccessError> & {
  /**
   * Создать или изменить роль.
   */
  saveRole: typeof saveAccessRole
  /**
   * Удалить неназначенную роль.
   */
  deleteRole: typeof deleteAccessRole
  /**
   * Создать аккаунт.
   */
  createAccount: typeof createManagedAccount
  /**
   * Изменить доступ аккаунта.
   */
  updateAccount: typeof updateManagedAccount
  /**
   * Привязать пользователя Keycloak.
   */
  bindIdentity: typeof bindManagedIdentity
  /**
   * Отозвать привязку пользователя.
   */
  unbindIdentity: typeof unbindManagedIdentity
  /**
   * Отключить локальный пароль.
   */
  disablePassword: typeof disableManagedPassword
  /**
   * Завершить все сессии аккаунта.
   */
  revokeSessions: typeof revokeManagedSessions
}

/**
 * Владеет приватным кешем и его обновлением после изменения доступа.
 */
export const useAccessManagement = (): AccessManagement => {
  const profile = useGetCurrentUser()
  const canManage = profile.error === undefined && profile.data?.permissions.includes('system.access.manage') === true
  const key = canManage ? ['admin-access', profile.data?.id] : null
  const query = useSWR<AccessData, AccessError>(key, getAccessData, { shouldRetryOnError: false, revalidateOnFocus: false, revalidateOnReconnect: false })
  /**
   * Обновляет список после успешной записи, не повторяя саму запись.
   */
  const refresh = async (): Promise<void> => { await query.mutate().catch(() => undefined) }
  return {
    ...query,
    saveRole: async (...args: Parameters<typeof saveAccessRole>): Promise<void> => { await saveAccessRole(...args); await refresh() },
    deleteRole: async (roleKey: string): Promise<void> => { await deleteAccessRole(roleKey); await refresh() },
    createAccount: async (...args: Parameters<typeof createManagedAccount>): Promise<void> => { await createManagedAccount(...args); await refresh() },
    updateAccount: async (...args: Parameters<typeof updateManagedAccount>): Promise<void> => { await updateManagedAccount(...args); await refresh() },
    bindIdentity: async (...args: Parameters<typeof bindManagedIdentity>): Promise<void> => { await bindManagedIdentity(...args); await refresh() },
    unbindIdentity: async (...args: Parameters<typeof unbindManagedIdentity>): Promise<void> => { await unbindManagedIdentity(...args); await refresh() },
    disablePassword: async (id: string): Promise<void> => { await disableManagedPassword(id); await refresh() },
    revokeSessions: async (id: string): Promise<void> => { await revokeManagedSessions(id); await refresh() }
  }
}
