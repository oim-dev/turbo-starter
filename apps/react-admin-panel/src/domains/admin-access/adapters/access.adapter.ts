import { rejectAuthentication } from 'domains/auth'
import { backendAdminApi, getBackendAdminApiErrorAccessToken, isBackendAdminApiError } from 'infra/backend-admin-api'
import { AccessError, classifyAccessError } from '../errors/access.error'
import { mapAccounts, mapPermissions, mapRoles } from '../mappers/access.mapper'
import type { AccessData, AccessRole, ManagedAccount, NewAccount } from '../types/access.type'

/**
 * Загружает данные управления доступом с полным контрактом ошибок для SWR.
 */
export const getAccessData = async (canManage: boolean): Promise<AccessData> => {
  try {
    const [permissions, roles, accounts] = await Promise.all([
      canManage ? backendAdminApi.access.adminPermissionsList() : Promise.resolve([]),
      canManage ? backendAdminApi.access.adminRolesList() : Promise.resolve([]),
      backendAdminApi.access.adminAccountsList()
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
export const saveAccessRole = async (
  role: Pick<AccessRole, 'key' | 'name' | 'permissions'>,
  version?: number
): Promise<AccessRole> => {
  try {
    const payload =
      version === undefined
        ? await backendAdminApi.access.adminRoleCreate({
            key: role.key,
            name: role.name,
            permissions: [...role.permissions]
          })
        : await backendAdminApi.access.adminRoleUpdate(
            { key: role.key },
            { name: role.name, permissions: [...role.permissions], version }
          )
    const [savedRole] = mapRoles([payload])
    if (savedRole === undefined) throw new Error('Missing saved role')
    return savedRole
  } catch (error) {
    throw classifyAccessError(error)
  }
}
/**
 * Удаляет дополнительную роль, если она никому не назначена.
 */
export const deleteAccessRole = async (key: string): Promise<void> => {
  try {
    await backendAdminApi.access.adminRoleDelete({ key })
  } catch (error) {
    throw classifyAccessError(error)
  }
}
/**
 * Создаёт аккаунт с явно выбранной ролью.
 */
export const createManagedAccount = async (input: NewAccount): Promise<ManagedAccount> => {
  try {
    const payload = await backendAdminApi.access.adminAccountCreate({
      login: input.login,
      password: input.password,
      role: input.role,
      name: input.name
    })
    const [savedAccount] = mapAccounts([payload])
    if (savedAccount === undefined) throw new Error('Missing created account')
    return savedAccount
  } catch (error) {
    throw classifyAccessError(error)
  }
}
/**
 * Сохраняет профиль и доступ аккаунта, возвращая подтверждённую версию.
 */
export const updateManagedAccount = async (
  input: Pick<ManagedAccount, 'id' | 'name' | 'login' | 'role' | 'isActive' | 'version'>
): Promise<ManagedAccount> => {
  try {
    const payload = await backendAdminApi.access.adminAccountUpdate(
      { id: input.id },
      { name: input.name, login: input.login, role: input.role, isActive: input.isActive, version: input.version }
    )
    const [savedAccount] = mapAccounts([payload])
    if (savedAccount === undefined) throw new Error('Missing updated account')
    return savedAccount
  } catch (error) {
    throw classifyAccessError(error)
  }
}

/**
 * Разрешает вход без изменения роли, профиля и способов аутентификации.
 */
export const activateManagedAccount = async (
  input: Pick<ManagedAccount, 'id' | 'version'>
): Promise<ManagedAccount> => {
  try {
    const payload = await backendAdminApi.access.adminAccountActivate({ id: input.id }, { version: input.version })
    const [savedAccount] = mapAccounts([payload])
    if (savedAccount === undefined) throw new Error('Missing activated account')
    return savedAccount
  } catch (error) {
    throw classifyAccessError(error)
  }
}
