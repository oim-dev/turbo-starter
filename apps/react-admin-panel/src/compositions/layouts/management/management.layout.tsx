import { IconKey, IconLayoutDashboard, IconListCheck, IconShieldCheck, IconUsers } from '@tabler/icons-react'
import type { JSX } from 'react'
import { AdminLayout } from 'compositions/layouts/admin'
import type { AdminNavigationItem } from 'compositions/layouts/admin'
import { usePermission } from 'domains/auth'

/**
 * Собирает layout управления с собственным меню в общем каркасе панели.
 *
 * Используется для:
 *  - навигации по команде, ролям, правам и корпоративному входу
 */
export const ManagementLayout = (): JSX.Element => {
  const canManageAccess = usePermission('system.access.manage')
  const canReadAccounts = usePermission('accounts.read')
  const canManageKeycloak = usePermission('system.keycloak.manage')
  const canOpenPanel = canReadAccounts || canManageAccess || canManageKeycloak
  const navigationItems: AdminNavigationItem[] = [
    { to: '/management', label: 'Обзор', icon: IconLayoutDashboard, end: true, isAllowed: canOpenPanel },
    { to: '/management/users', label: 'Команда', icon: IconUsers, isAllowed: canReadAccounts },
    { to: '/management/roles', label: 'Роли', icon: IconShieldCheck, isAllowed: canManageAccess },
    { to: '/management/permissions', label: 'Права доступа', icon: IconListCheck, isAllowed: canManageAccess },
    { to: '/management/keycloak', label: 'Корпоративный вход', icon: IconKey, isAllowed: canManageKeycloak }
  ].filter((entry) => entry.isAllowed)

  return <AdminLayout navigationItems={navigationItems} />
}
