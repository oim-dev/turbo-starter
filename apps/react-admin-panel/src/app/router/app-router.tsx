import { createBrowserRouter } from 'react-router-dom'
import { AdminLayout } from 'compositions/layouts/admin'
import { AuthenticationBoundary } from 'compositions/route-boundaries/authentication'
import { SessionBoundary } from 'compositions/route-boundaries/session'
import { HomeScreen } from 'compositions/screens/home'
import { ProfileScreen } from 'compositions/screens/profile'
import { NotFoundScreen } from 'compositions/screens/not-found'
import { SignInScreen } from 'compositions/screens/sign-in'
import { KeycloakCallbackScreen } from 'compositions/screens/keycloak-callback'
import { AccessScreen } from 'compositions/screens/access'
import { KeycloakSettingsScreen } from 'compositions/screens/keycloak-settings'
import { PermissionBoundary } from 'compositions/route-boundaries/permission'
import { RouteErrorBoundary } from './route-error-boundary/route-error-boundary'
import { RoutePending } from './route-pending/route-pending'

/**
 * Определяет дерево URL и общие состояния маршрутизации приложения.
 */
export const appRouter = createBrowserRouter([
  {
    path: '/',
    Component: AuthenticationBoundary,
    errorElement: <RouteErrorBoundary />,
    hydrateFallbackElement: <RoutePending />,
    children: [
      {
        path: 'auth/keycloak/callback',
        Component: KeycloakCallbackScreen
      },
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
              },
              {
                element: <PermissionBoundary permission="system.access.manage" />,
                children: [{ path: 'access', Component: AccessScreen }]
              },
              {
                element: <PermissionBoundary permission="system.keycloak.manage" />,
                children: [{ path: 'settings/keycloak', Component: KeycloakSettingsScreen }]
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
