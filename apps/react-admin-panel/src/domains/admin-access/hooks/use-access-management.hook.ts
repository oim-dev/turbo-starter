import useSWR from 'swr'
import type { SWRResponse } from 'swr'
import { useGetCurrentUser } from 'domains/auth'
import {
  createManagedAccount,
  deleteAccessRole,
  getAccessData,
  saveAccessRole,
  updateManagedAccount,
  activateManagedAccount
} from '../adapters/access.adapter'
import {
  bindManagedIdentity,
  unbindManagedIdentity,
  disableManagedPassword,
  setManagedPassword,
  revokeManagedSessions
} from '../adapters/account-security.adapter'
import type { AccessError } from '../errors/access.error'
import type { AccessData, AccessRole, ManagedAccount } from '../types/access.type'

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
   * Разрешить вход существующему пользователю.
   */
  activateAccount: typeof activateManagedAccount
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
   * Задать новый локальный пароль.
   */
  setPassword: typeof setManagedPassword
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
  const canRead = profile.error === undefined && profile.data?.permissions.includes('accounts.read') === true
  const key = canManage || canRead ? ['admin-access', profile.data?.id, canManage] : null
  const query = useSWR<AccessData, AccessError>(key, () => getAccessData(canManage), {
    shouldRetryOnError: false,
    revalidateOnFocus: false,
    revalidateOnReconnect: false
  })
  /**
   * Обновляет список после успешной записи, не повторяя саму запись.
   */
  const refresh = async (): Promise<void> => {
    await query.mutate().catch(() => undefined)
  }
  /**
   * Публикует подтверждённый аккаунт без повторного чтения отозванной собственной сессии.
   */
  const storeAccount = async (savedAccount: ManagedAccount): Promise<void> => {
    await query.mutate(
      (current) => {
        if (current === undefined) return current
        const otherAccounts = current.accounts.filter((account) => account.id !== savedAccount.id)
        return { ...current, accounts: [...otherAccounts, savedAccount] }
      },
      { revalidate: false }
    )
  }
  return {
    ...query,
    saveRole: async (...args: Parameters<typeof saveAccessRole>): Promise<AccessRole> => {
      const savedRole = await saveAccessRole(...args)
      await refresh()
      return savedRole
    },
    deleteRole: async (roleKey: string): Promise<void> => {
      await deleteAccessRole(roleKey)
      await refresh()
    },
    createAccount: async (...args: Parameters<typeof createManagedAccount>): Promise<ManagedAccount> => {
      const savedAccount = await createManagedAccount(...args)
      await storeAccount(savedAccount)
      return savedAccount
    },
    updateAccount: async (...args: Parameters<typeof updateManagedAccount>): Promise<ManagedAccount> => {
      const savedAccount = await updateManagedAccount(...args)
      await storeAccount(savedAccount)
      return savedAccount
    },
    activateAccount: async (...args: Parameters<typeof activateManagedAccount>): Promise<ManagedAccount> => {
      const savedAccount = await activateManagedAccount(...args)
      await storeAccount(savedAccount)
      return savedAccount
    },
    bindIdentity: async (...args: Parameters<typeof bindManagedIdentity>): Promise<void> => {
      await bindManagedIdentity(...args)
      await refresh()
    },
    unbindIdentity: async (...args: Parameters<typeof unbindManagedIdentity>): Promise<void> => {
      await unbindManagedIdentity(...args)
      await refresh()
    },
    disablePassword: async (id: string): Promise<void> => {
      await disableManagedPassword(id)
      await refresh()
    },
    setPassword: async (...args: Parameters<typeof setManagedPassword>): Promise<void> => {
      await setManagedPassword(...args)
      await refresh()
    },
    revokeSessions: async (id: string): Promise<void> => {
      await revokeManagedSessions(id)
      await refresh()
    }
  }
}
