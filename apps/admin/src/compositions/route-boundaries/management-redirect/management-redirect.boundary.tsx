import type { JSX } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { getCanonicalManagementPath } from 'shared/navigation'

/**
 * Перенаправляет старые адреса управления, сохраняя query, hash и состояние перехода.
 *
 * Используется для:
 *  - совместимости сохранённых ссылок и истории браузера
 */
export const ManagementRedirectBoundary = (): JSX.Element => {
  const location = useLocation()
  const targetLocation = {
    pathname: getCanonicalManagementPath(location.pathname),
    search: location.search,
    hash: location.hash
  }

  return <Navigate to={targetLocation} state={location.state} replace />
}
