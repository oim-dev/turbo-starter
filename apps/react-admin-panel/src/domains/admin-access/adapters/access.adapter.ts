import { rejectAuthentication } from 'domains/auth'
import { backendAdminApi, getBackendAdminApiErrorAccessToken, isBackendAdminApiError } from 'infra/backend-admin-api'
import { AccessError, classifyAccessError } from '../errors/access.error'
import { mapAccounts, mapPermissions, mapRoles } from '../mappers/access.mapper'
import type { AccessData, AccessRole, ManagedAccount, NewAccount } from '../types/access.type'

/**
 * Загружает данные управления доступом с полным контрактом ошибок для SWR.
 */
export const getAccessData = async (): Promise<AccessData> => {
  try {
    const [permissions, roles, accounts] = await Promise.all([
      backendAdminApi.access.adminPermissionsList(), backendAdminApi.access.adminRolesList(), backendAdminApi.access.adminAccountsList()
    ])
    return { permissions: mapPermissions(permissions), roles: mapRoles(roles), accounts: mapAccounts(accounts) }
  } catch (error) {
    if (isBackendAdminApiError(error) && error.status === 401) {
      rejectAuthentication(getBackendAdminApiErrorAccessToken(error))
    }
    throw new AccessError('Не удалось загрузить управление доступом. Проверьте сессию и повторите загрузку.')
  }
}
/**
 * Создаёт дополнительную роль либо обновляет её ожидаемую версию.
 */
export const saveAccessRole = async (role: Pick<AccessRole, 'key' | 'name' | 'permissions'>, version?: number): Promise<void> => {
  try {
    if (version === undefined) {
      await backendAdminApi.access.adminRoleCreate({ key: role.key, name: role.name, permissions: [...role.permissions] })
      return
    }
    await backendAdminApi.access.adminRoleUpdate({ key: role.key }, { name: role.name, permissions: [...role.permissions], version })
  } catch (error) { throw classifyAccessError(error) }
}
/**
 * Удаляет дополнительную роль, если она никому не назначена.
 */
export const deleteAccessRole = async (key: string): Promise<void> => {
  try { await backendAdminApi.access.adminRoleDelete({ key }) } catch (error) { throw classifyAccessError(error) }
}
/**
 * Создаёт аккаунт с явно выбранной ролью.
 */
export const createManagedAccount = async (input: NewAccount): Promise<void> => {
  try { await backendAdminApi.access.adminAccountCreate({ login: input.login, password: input.password, role: input.role, name: input.name }) } catch (error) { throw classifyAccessError(error) }
}
/**
 * Изменяет доступ аккаунта и отзывает его прежние сессии.
 */
export const updateManagedAccount = async (input: Pick<ManagedAccount, 'id' | 'role' | 'isActive' | 'version'>): Promise<void> => {
  try { await backendAdminApi.access.adminAccountUpdate({ id: input.id }, { role: input.role, isActive: input.isActive, version: input.version }) } catch (error) { throw classifyAccessError(error) }
}
