import { Alert, Loader } from '@mantine/core'
import type { JSX } from 'react'
import { Outlet } from 'react-router-dom'
import { useGetCurrentUser } from 'domains/auth'
import type { PermissionProps } from './types/permission-props.type'

/**
 * Ограничивает маршрут по подтверждённым сервером правам.
 *
 * Используется для:
 *  - допуска владельца к системным экранам
 */
export const PermissionBoundary = ({ permission }: PermissionProps): JSX.Element => {
  const profile = useGetCurrentUser()
  if (profile.isLoading) return <Loader aria-label="Проверяем доступ" />
  if (profile.error !== undefined) return <Alert color="red">Не удалось подтвердить права. Обновите страницу.</Alert>
  if (profile.data?.permissions.includes(permission) !== true) return <Alert color="yellow" title="Нет доступа">Этот раздел доступен только владельцу.</Alert>
  return <Outlet />
}
