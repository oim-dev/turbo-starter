import { useGetCurrentUser } from './use-get-current-user/use-get-current-user.hook'

/**
 * Применяет серверный снимок прав только при успешном подтверждении профиля.
 */
export const usePermission = (permission: string): boolean => {
  const profile = useGetCurrentUser()
  return profile.error === undefined && profile.data?.permissions.includes(permission) === true
}
