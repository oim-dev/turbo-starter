import { ActionIcon, AppShell, Burger, Group, Text, ThemeIcon } from '@mantine/core'
import { IconFlask2, IconMoon, IconSun } from '@tabler/icons-react'
import cl from 'clsx'
import { Link } from 'react-router-dom'

import { AuthUserMenu } from 'domains/auth/client'
import { useThemeColorScheme } from 'infra/theme'
import type { HeaderProps } from './types/header-props.type'
import styles from './styles/header.module.css'

/**
 * Верхняя панель основного layout.
 *
 * Используется для:
 *  - открытия мобильной навигации
 *  - переключения цветовой схемы
 *  - отображения названия приложения и пользователя
 */
export const Header = (props: HeaderProps) => {
  const { isNavbarOpened, onNavbarToggle, className, ...rootAttrs } = props
  const { isDark, toggleColorScheme } = useThemeColorScheme()
  const navbarButtonLabel = isNavbarOpened ? 'Закрыть навигацию' : 'Открыть навигацию'
  const colorSchemeButtonLabel = isDark ? 'Включить светлую тему' : 'Включить тёмную тему'
  const ColorSchemeIcon = isDark ? IconSun : IconMoon

  return (
    <AppShell.Header {...rootAttrs} className={cl(styles.root, className)}>
      <Group className={styles.inner} gap="sm" h="100%" px="md" wrap="nowrap">
        <Burger
          aria-label={navbarButtonLabel}
          hiddenFrom="sm"
          opened={isNavbarOpened}
          size="sm"
          onClick={onNavbarToggle}
        />
        <Text className={styles.brand} component={Link} fw={700} to="/">
          <ThemeIcon radius="md" size="md">
            <IconFlask2 size={18} stroke={1.8} />
          </ThemeIcon>
          BIOCAD Admin
        </Text>
        <Group ml="auto">
          <ActionIcon
            aria-label={colorSchemeButtonLabel}
            size="lg"
            variant="default"
            onClick={toggleColorScheme}
          >
            <ColorSchemeIcon size={18} stroke={1.8} />
          </ActionIcon>
          <AuthUserMenu />
        </Group>
      </Group>
    </AppShell.Header>
  )
}
