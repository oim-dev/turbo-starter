import { Avatar, Group, Menu, Text, UnstyledButton } from '@mantine/core'
import { IconChevronDown, IconLogout } from '@tabler/icons-react'
import cl from 'clsx'
import { useState } from 'react'

import { useAuth } from '../../hooks/use-auth.hook'
import styles from './styles/auth-user-menu.module.css'

/**
 * Меню текущего административного пользователя.
 *
 * Используется для:
 *  - отображения имени authenticated-пользователя
 *  - завершения BFF- и Keycloak-сессии
 */
export const AuthUserMenu = () => {
  const { hasLogoutError, isLoggingOut, logout, state } = useAuth()
  const [isMenuOpened, setIsMenuOpened] = useState(false)

  if (state.status !== 'authenticated') {
    return null
  }

  const { displayName } = state.session
  const avatarLabel = displayName.charAt(0).toUpperCase()
  const logoutLabel = isLoggingOut ? 'Выходим...' : 'Выйти'

  /**
   * Завершает сессию без необработанного rejected Promise.
   */
  const handleLogout = (): void => {
    void logout()
  }

  return (
    <Menu
      closeOnItemClick={false}
      position="bottom-end"
      width={200}
      withinPortal
      onClose={() => setIsMenuOpened(false)}
      onOpen={() => setIsMenuOpened(true)}
    >
      <Menu.Target>
        <UnstyledButton className={cl(styles.root, isMenuOpened && styles.active)}>
          <Group gap="xs" wrap="nowrap">
            <Avatar color="blue" radius="xl" size="sm">
              {avatarLabel}
            </Avatar>
            <Text fw={500} size="sm" visibleFrom="xs">
              {displayName}
            </Text>
            <IconChevronDown size={14} stroke={1.6} />
          </Group>
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Label>{displayName}</Menu.Label>
        <Menu.Item
          color="red"
          disabled={isLoggingOut}
          leftSection={<IconLogout size={16} stroke={1.6} />}
          onClick={handleLogout}
        >
          {logoutLabel}
        </Menu.Item>
        {hasLogoutError && (
          <Text c="red" px="sm" py="xs" size="xs">
            Не удалось завершить сессию. Повторите попытку.
          </Text>
        )}
      </Menu.Dropdown>
    </Menu>
  )
}
