import { Burger, Group } from '@mantine/core'
import cl from 'clsx'
import type { JSX } from 'react'
import { AccountMenu } from 'compositions/layouts/admin/ui/admin-header/ui/account-menu'
import { AdminBreadcrumbs } from 'compositions/layouts/admin/ui/admin-header/ui/admin-breadcrumbs'
import { ThemeSwitcher } from 'compositions/layouts/admin/ui/admin-header/ui/theme-switcher'
import type { AdminHeaderProps } from './types/admin-header-props.type'
import styles from './styles/admin-header.module.css'

/**
 * Показывает пользователя и действия шапки административного каркаса.
 *
 * Используется для:
 *  - завершения сеанса сотрудника
 *  - открытия и закрытия мобильного сайдбара
 */
export const AdminHeader = (props: AdminHeaderProps): JSX.Element => {
  const { userLogin, isNavigationOpened, onToggleNavigation, onLogout, className, ...rootAttrs } = props
  const navigationLabel = isNavigationOpened ? 'Закрыть меню' : 'Открыть меню'

  return (
    <Group {...rootAttrs} className={cl(styles.root, className)} h="100%" justify="space-between" wrap="nowrap">
      <Group gap="sm" wrap="nowrap" className={styles.navigation}>
        <Burger
          opened={isNavigationOpened}
          onClick={onToggleNavigation}
          hiddenFrom="sm"
          size="sm"
          aria-label={navigationLabel}
          aria-controls="admin-navigation"
          aria-expanded={isNavigationOpened}
        />
        <AdminBreadcrumbs />
      </Group>
      <Group gap="sm" wrap="nowrap" className={styles.actions}>
        <ThemeSwitcher />
        <div className={styles.divider} aria-hidden="true" />
        <AccountMenu userLogin={userLogin} onLogout={onLogout} />
      </Group>
    </Group>
  )
}
