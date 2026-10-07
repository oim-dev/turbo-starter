import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { useAuth } from '../../hooks/use-auth.hook'

/**
 * Закрывает route branch от anonymous-пользователя.
 *
 * Используется для:
 *  - перенаправления на страницу входа с сохранением текущего маршрута
 */
export const RequireAuth = () => {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status !== 'authenticated') {
    const returnTo = `${location.pathname}${location.search}${location.hash}`
    const query = new URLSearchParams({ returnTo })

    return <Navigate replace to={`/login?${query.toString()}`} />
  }

  return <Outlet />
}
