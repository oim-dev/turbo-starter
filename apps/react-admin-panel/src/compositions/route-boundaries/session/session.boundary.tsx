import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthentication } from 'domains/auth'
import { getSessionReturnTo } from './helpers/get-session-return-to'
import { SessionPending } from './ui/session-pending/session-pending'
import type { SessionBoundaryProps } from './types/session-boundary-props.type'

/**
 * Связывает подтверждённое состояние сессии с доступом к маршрутной ветке.
 *
 * Используется для:
 *  - защиты приватного содержимого до подтверждения текущего администратора
 *  - возврата из гостевой ветки после подтверждённого входа
 */
export const SessionBoundary = (props: SessionBoundaryProps) => {
  const { access } = props
  const authentication = useAuthentication()
  const location = useLocation()
  const isChecking = authentication.status === 'checking'

  if (isChecking || authentication.status === 'error') {
    return <SessionPending error={authentication.error} isChecking={isChecking} />
  }

  if (access === 'guest' && authentication.status === 'authenticated') {
    return <Navigate replace to={getSessionReturnTo(location.state)} />
  }

  if (access === 'authenticated' && authentication.status === 'guest') {
    const returnTo = getSessionReturnTo({
      returnTo: `${location.pathname}${location.search}${location.hash}`
    })

    return <Navigate replace state={{ returnTo }} to="/sign-in" />
  }

  return <Outlet />
}
