import { Avatar, Box, Menu, Text, UnstyledButton } from '@mantine/core'
import { IconChevronDown, IconLogout, IconUser, IconLock, IconSettings } from '@tabler/icons-react'
import cl from 'clsx'
import type { JSX } from 'react'
import { Link } from 'react-router-dom'
import { usePermission } from 'domains/auth'
import type { AccountMenuProps } from './types/account-menu-props.type'
import styles from './styles/account-menu.module.css'

/**
 * Показывает текущую учётную запись, ссылку на профиль и действие завершения сеанса.
 *
 * Используется для:
 *  - открытия профиля администратора из шапки
 *  - вызова существующего сценария выхода
 */
export const AccountMenu = (props: AccountMenuProps): JSX.Element => {
  const { userLogin, userName, roleName, onLogout, className, ...rootAttrs } = props
  const canManageAccess = usePermission('system.access.manage')
  const canReadAccounts = usePermission('accounts.read')
  const canManageKeycloak = usePermission('system.keycloak.manage')
  const canOpenManagement = canReadAccounts || canManageAccess || canManageKeycloak
  const userLabel = userName.trim() || userLogin || 'Администратор'
  const menuLabel = `Меню пользователя ${userLabel}`

  return (
    <Menu position="bottom-end" width={240} shadow="md" offset={10}>
      <Menu.Target>
        <UnstyledButton {...rootAttrs} className={cl(styles.root, className)} type="button" aria-label={menuLabel}>
          <Avatar name={userLabel} size={34} radius="xl" color="brand" />
          <div className={styles.login}>
            <Text size="sm" fw={600} truncate title={userLabel}>
              {userLabel}
            </Text>
            <Text size="xs" c="dimmed" truncate>
              {roleName}
            </Text>
          </div>
          <IconChevronDown className={styles.chevron} size={15} aria-hidden="true" />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Box px="sm" py="xs">
          <Text size="sm" fw={600} truncate title={userLabel}>
            {userLabel}
          </Text>
          <Text size="xs" c="dimmed" truncate>
            {userLogin}
          </Text>
        </Box>
        <Menu.Divider />
        <Menu.Item component={Link} to="/profile" leftSection={<IconUser size={17} aria-hidden="true" />}>
          Мой профиль
        </Menu.Item>
        <Menu.Item component={Link} to="/profile?tab=security" leftSection={<IconLock size={17} aria-hidden="true" />}>
          Безопасность
        </Menu.Item>
        {canOpenManagement && (
          <Menu.Item component={Link} to="/management" leftSection={<IconSettings size={17} aria-hidden="true" />}>
            Панель управления
          </Menu.Item>
        )}
        <Menu.Divider />
        <Menu.Item color="red" leftSection={<IconLogout size={17} aria-hidden="true" />} onClick={onLogout}>
          Выйти из аккаунта
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
