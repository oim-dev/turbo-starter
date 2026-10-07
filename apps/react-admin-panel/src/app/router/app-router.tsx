import { createBrowserRouter } from 'react-router-dom'
import { AdminLayout } from 'compositions/layouts/admin'
import { SessionBoundary } from 'compositions/route-boundaries/session'
import { HomeScreen } from 'compositions/screens/home'
import { ProfileScreen } from 'compositions/screens/profile'
import { NotFoundScreen } from 'compositions/screens/not-found'
import { SignInScreen } from 'compositions/screens/sign-in'
import { RouteErrorBoundary } from './route-error-boundary/route-error-boundary'
import { RoutePending } from './route-pending/route-pending'

/**
 * Определяет дерево URL и общие состояния маршрутизации приложения.
 */
export const appRouter = createBrowserRouter([
  {
    path: '/',
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <RoutePending />,
    children: [
      {
        element: <SessionBoundary access="guest" />,
        children: [
          {
            path: 'sign-in',
            Component: SignInScreen
          }
        ]
      },
      {
        element: <SessionBoundary access="authenticated" />,
        children: [
          {
            Component: AdminLayout,
            children: [
              {
                index: true,
                Component: HomeScreen
              },
              {
                path: 'profile',
                Component: ProfileScreen
              }
            ]
          }
        ]
      },
      {
        path: '*',
        Component: NotFoundScreen
      }
    ]
  }
])
