import { AppShell, NavLink, ScrollArea, Stack, Text } from '@mantine/core'
import { IconCategory, IconFileText, IconLayoutDashboard, IconList } from '@tabler/icons-react'
import cl from 'clsx'
import { Link, useLocation } from 'react-router-dom'

import type { SidebarProps } from './types/sidebar-props.type'
import styles from './styles/sidebar.module.css'

/**
 * Боковая навигация панели администрирования.
 *
 * Используется для:
 *  - перехода между разделами кабинета
 *  - закрытия мобильной навигации после перехода
 */
export const Sidebar = (props: SidebarProps) => {
  const { onNavigate, className, ...rootAttrs } = props
  const { pathname } = useLocation()
  const isPublicationsActive = pathname.startsWith('/publications')
  const isCategoriesActive = pathname === '/publications/categories'
  const isPublicationListActive = isPublicationsActive && !isCategoriesActive

  return (
    <AppShell.Navbar {...rootAttrs} className={cl(styles.root, className)} p="md">
      <AppShell.Section mb="md">
        <Text c="dimmed" fw={600} size="xs" tt="uppercase">
          Управление
        </Text>
      </AppShell.Section>
      <AppShell.Section grow>
        <ScrollArea h="100%">
          <Stack gap={4}>
            <NavLink
              active={pathname === '/'}
              component={Link}
              label="Главная"
              leftSection={<IconLayoutDashboard size={18} stroke={1.7} />}
              to="/"
              onClick={onNavigate}
            />
            <NavLink
              active={isPublicationsActive}
              defaultOpened={isPublicationsActive}
              label="Публикации"
              leftSection={<IconFileText size={18} stroke={1.7} />}
            >
              <NavLink
                active={isPublicationListActive}
                component={Link}
                label="Все публикации"
                leftSection={<IconList size={17} stroke={1.7} />}
                to="/publications"
                onClick={onNavigate}
              />
              <NavLink
                active={isCategoriesActive}
                component={Link}
                label="Категории"
                leftSection={<IconCategory size={17} stroke={1.7} />}
                to="/publications/categories"
                onClick={onNavigate}
              />
            </NavLink>
          </Stack>
        </ScrollArea>
      </AppShell.Section>
    </AppShell.Navbar>
  )
}
