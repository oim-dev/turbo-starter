import { createBrowserRouter } from 'react-router-dom'
import { AdminLayout } from 'compositions/layouts/admin'
import { ManagementLayout } from 'compositions/layouts/management'
import { AuthenticationBoundary } from 'compositions/route-boundaries/authentication'
import { SessionBoundary } from 'compositions/route-boundaries/session'
import { HomeScreen } from 'compositions/screens/home'
import { ImagesScreen } from 'compositions/screens/images'
import { ManagementScreen } from 'compositions/screens/management'
import { ProfileScreen } from 'compositions/screens/profile'
import { NotFoundScreen } from 'compositions/screens/not-found'
import { SignInScreen } from 'compositions/screens/sign-in'
import { KeycloakCallbackScreen } from 'compositions/screens/keycloak-callback'
import { UsersScreen } from 'compositions/screens/users'
import { UserDetailsScreen } from 'compositions/screens/user-details'
import { RolesScreen } from 'compositions/screens/roles'
import { PermissionsScreen } from 'compositions/screens/permissions'
import { KeycloakSettingsScreen } from 'compositions/screens/keycloak-settings'
import { PermissionBoundary } from 'compositions/route-boundaries/permission'
import { ManagementRedirectBoundary } from 'compositions/route-boundaries/management-redirect'
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
                element: <PermissionBoundary permission="images.read" />,
                children: [{ path: 'images', Component: ImagesScreen }]
              }
            ]
          },
          {
            path: 'management',
            Component: ManagementLayout,
            children: [
              {
                element: <PermissionBoundary permission={['accounts.read', 'system.access.manage', 'system.keycloak.manage']} />,
                children: [{ index: true, Component: ManagementScreen }]
              },
              {
                element: <PermissionBoundary permission="system.access.manage" />,
                children: [
                  { path: 'users/new', Component: UserDetailsScreen },
                  { path: 'roles', Component: RolesScreen },
                  { path: 'roles/new', Component: RolesScreen },
                  { path: 'roles/:roleKey', Component: RolesScreen },
                  { path: 'permissions', Component: PermissionsScreen }
                ]
              },
              {
                element: <PermissionBoundary permission="accounts.read" />,
                children: [
                  { path: 'users', Component: UsersScreen },
                  { path: 'users/:accountId', Component: UserDetailsScreen }
                ]
              },
              {
                element: <PermissionBoundary permission="system.keycloak.manage" />,
                children: [{ path: 'keycloak', Component: KeycloakSettingsScreen }]
              }
            ]
          },
          ...[
            'access',
            'access/users',
            'access/users/new',
            'access/users/:accountId',
            'access/roles',
            'access/roles/new',
            'access/roles/:roleKey',
            'access/permissions',
            'settings/keycloak'
          ].map((path) => ({ path, Component: ManagementRedirectBoundary }))
        ]
      },
      {
        path: '*',
        Component: NotFoundScreen
      }
    ]
  }
])
