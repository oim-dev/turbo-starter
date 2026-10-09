import { matchPath, Outlet, useLocation } from 'react-router-dom'
import { AuthProvider } from 'domains/auth'

/**
 * Выбирает режим единственного lifecycle сессии по назначению маршрутной ветки.
 *
 * Используется для:
 *  - приостановки обычного bootstrap при одноразовом завершении Keycloak
 *  - сохранения общего провайдера при переходах между экранами
 */
export const AuthenticationBoundary = () => {
  const location = useLocation()
  const isCallback = matchPath('/auth/keycloak/callback', location.pathname) !== null

  return (
    <AuthProvider shouldRestoreSession={!isCallback}>
      <Outlet />
    </AuthProvider>
  )
}
