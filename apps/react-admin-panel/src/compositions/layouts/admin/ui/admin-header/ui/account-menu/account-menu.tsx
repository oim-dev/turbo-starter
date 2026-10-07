import { Box, Menu, Text, UnstyledButton } from '@mantine/core'
import { IconChevronDown, IconLogout, IconUser } from '@tabler/icons-react'
import cl from 'clsx'
import type { JSX } from 'react'
import { Link } from 'react-router-dom'
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
  const { userLogin, onLogout, className, ...rootAttrs } = props
  const userLabel = userLogin ?? 'Администратор'
  const menuLabel = `Меню пользователя ${userLabel}`

  return (
    <Menu position="bottom-end" width={240} shadow="md" offset={10}>
      <Menu.Target>
        <UnstyledButton {...rootAttrs} className={cl(styles.root, className)} type="button" aria-label={menuLabel}>
          <IconUser size={22} aria-hidden="true" />
          <Text className={styles.login} size="sm" fw={600} truncate title={userLabel}>{userLabel}</Text>
          <IconChevronDown className={styles.chevron} size={15} aria-hidden="true" />
        </UnstyledButton>
      </Menu.Target>
      <Menu.Dropdown>
        <Box px="sm" py="xs">
          <Text size="xs" c="dimmed">Вы вошли как</Text>
          <Text size="sm" fw={600} truncate title={userLabel}>{userLabel}</Text>
        </Box>
        <Menu.Divider />
        <Menu.Item component={Link} to="/profile" leftSection={<IconUser size={17} aria-hidden="true" />}>
          Мой профиль
        </Menu.Item>
        <Menu.Item color="red" leftSection={<IconLogout size={17} aria-hidden="true" />} onClick={onLogout}>
          Выйти из аккаунта
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  )
}
