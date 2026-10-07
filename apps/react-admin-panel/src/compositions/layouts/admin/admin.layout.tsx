import { AppShell, Drawer, useMantineTheme } from '@mantine/core'
import { useDisclosure, useLocalStorage, useMediaQuery, useReducedMotion } from '@mantine/hooks'
import { useEffect } from 'react'
import type { JSX } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { isAuthError, logout, useGetCurrentUser } from 'domains/auth'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { AdminHeader } from 'compositions/layouts/admin/ui/admin-header'
import { AdminSidebar } from 'compositions/layouts/admin/ui/admin-sidebar'
import styles from './styles/admin.module.css'

/**
 * Показывает постоянный каркас приватной панели администратора.
 *
 * Используется для:
 *  - размещения сайдбара, шапки пользователя и тела текущего экрана
 *  - управления мобильной навигацией и завершением сеанса
 */
export const AdminLayout = (): JSX.Element => {
  const currentUser = useGetCurrentUser()
  const userLogin = currentUser.data?.login ?? null
  const [isNavigationOpened, { toggle: toggleNavigation, close: closeNavigation }] = useDisclosure(false)
  const [isSidebarCompact, setIsSidebarCompact] = useLocalStorage<boolean>({
    key: 'react-admin-panel-sidebar-compact',
    defaultValue: false,
    getInitialValueInEffect: false,
    serialize: String,
    deserialize: (storedValue) => storedValue === 'true'
  })
  const theme = useMantineTheme()
  const location = useLocation()
  const shouldReduceMotion = useReducedMotion()
  const isDesktop = useMediaQuery(`(min-width: ${theme.breakpoints.sm})`, false, { getInitialValueInEffect: false })
  const isMobileNavigationOpened = isNavigationOpened && !isDesktop
  const sidebarWidth = isSidebarCompact ? 72 : 240
  const transitionDuration = shouldReduceMotion ? 0 : 180

  useEffect(() => {
    closeNavigation()
  }, [location.key, isDesktop, closeNavigation])

  /**
   * Сохраняет плотность настольной навигации как настройку этого браузера.
   */
  const handleToggleSidebar = (): void => setIsSidebarCompact((isCompact) => !isCompact)

  /**
   * Завершает локальный сеанс сразу, сохраняя доменную причину неполного выхода.
   */
  const handleLogout = async (): Promise<void> => {
    try {
      await logout()
    } catch (error) {
      if (isAuthError(error)) {
        // Домен уже закрыл приватный UI и передал причину гостевому экрану.
        return
      }

      reportApplicationDefect(toApplicationDefect('admin.logout', error))
    }
  }

  return (
    <AppShell
      className={styles.root}
      layout="alt"
      header={{ height: 64 }}
      navbar={{ width: sidebarWidth, breakpoint: 'sm', collapsed: { mobile: true } }}
      padding={{ base: 16, sm: 24, lg: 32 }}
      transitionDuration={transitionDuration}
    >
      <a className={styles.skipLink} href="#admin-content">
        К содержимому
      </a>

      <AppShell.Header className={styles.header} inert={isMobileNavigationOpened}>
        <AdminHeader
          userLogin={userLogin}
          isNavigationOpened={isMobileNavigationOpened}
          onToggleNavigation={toggleNavigation}
          onLogout={handleLogout}
        />
      </AppShell.Header>

      <AppShell.Navbar className={styles.navbar} visibleFrom="sm" inert={!isDesktop}>
        <AdminSidebar
          isCompact={isSidebarCompact}
          onNavigate={closeNavigation}
          onToggleCompact={handleToggleSidebar}
        />
      </AppShell.Navbar>

      <AppShell.Main className={styles.main} id="admin-content" tabIndex={-1} inert={isMobileNavigationOpened}>
        <div className={styles.content}>
          <Outlet />
        </div>
      </AppShell.Main>

      <Drawer.Root
        opened={isMobileNavigationOpened}
        onClose={closeNavigation}
        size="min(20rem, calc(100vw - 2rem))"
        padding={0}
        transitionProps={{ duration: transitionDuration }}
      >
        <Drawer.Overlay backgroundOpacity={0.4} blur={2} />
        <Drawer.Content id="admin-navigation" aria-label="Разделы админ-панели">
          <Drawer.Body className={styles.drawerBody}>
            <AdminSidebar isCompact={false} onNavigate={closeNavigation} onClose={closeNavigation} />
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Root>
    </AppShell>
  )
}
