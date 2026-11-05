import { Alert, Loader } from '@mantine/core'
import type { JSX } from 'react'
import { Outlet } from 'react-router-dom'
import { useGetCurrentUser } from 'domains/management/auth'
import type { PermissionProps } from './types/permission-props.type'

/**
 * Ограничивает маршрут по подтверждённым сервером правам.
 *
 * Используется для:
 *  - допуска к разделам по назначенным разрешениям
 */
export const PermissionBoundary = ({ permission }: PermissionProps): JSX.Element => {
  const profile = useGetCurrentUser()
  const requiredPermissions = typeof permission === 'string' ? [permission] : permission
  const currentPermissions = profile.data?.permissions ?? []
  const hasPermission = requiredPermissions.some((key) => currentPermissions.includes(key))
  if (profile.isLoading) return <Loader aria-label="Проверяем доступ" />
  if (profile.error !== undefined) return <Alert color="red">Не удалось подтвердить права. Обновите страницу.</Alert>
  if (!hasPermission)
    return (
      <Alert color="yellow" title="Нет доступа">
        У вашей учётной записи нет прав на этот раздел. Обратитесь к администратору.
      </Alert>
    )
  return <Outlet />
}
