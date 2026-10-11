import { AppShell, Drawer, useMantineTheme } from '@mantine/core'
import { useDisclosure, useLocalStorage, useMediaQuery, useReducedMotion } from '@mantine/hooks'
import { IconHome, IconLibraryPhoto } from '@tabler/icons-react'
import cl from 'clsx'
import { useEffect } from 'react'
import type { JSX } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { isAuthError, logout, useGetCurrentUser, usePermission } from 'domains/management/auth'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { AdminHeader } from 'compositions/layouts/admin/ui/admin-header'
import { AdminSidebar } from 'compositions/layouts/admin/ui/admin-sidebar'
import type { AdminNavigationItem } from 'compositions/layouts/admin/ui/admin-sidebar'
import type { AdminLayoutProps } from './types/admin-layout-props.type'
import styles from './styles/admin.module.css'

/**
 * Навигация обычного рабочего пространства по реализованным разделам продукта.
 */
const DEFAULT_NAVIGATION_ITEMS: readonly AdminNavigationItem[] = [
  { to: '/', label: 'Главная', icon: IconHome, end: true }
]

/**
 * Показывает постоянный каркас приватной панели администратора.
 *
 * Используется для:
 *  - размещения сайдбара, шапки пользователя и тела текущего экрана
 *  - управления мобильной навигацией и завершением сеанса
 */
export const AdminLayout = (props: AdminLayoutProps): JSX.Element => {
  const { navigationItems: customNavigationItems, className, ...rootAttrs } = props
  const canReadImages = usePermission('images.read')
  const navigationItems = customNavigationItems ?? [
    ...DEFAULT_NAVIGATION_ITEMS,
    ...(canReadImages ? [{ to: '/images', label: 'Изображения', icon: IconLibraryPhoto }] : [])
  ]
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
      {...rootAttrs}
      className={cl(styles.root, className)}
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
          userName={currentUser.data?.name ?? ''}
          roleName={currentUser.data?.roleName ?? ''}
          isNavigationOpened={isMobileNavigationOpened}
          onToggleNavigation={toggleNavigation}
          onLogout={handleLogout}
        />
      </AppShell.Header>

      <AppShell.Navbar className={styles.navbar} visibleFrom="sm" inert={!isDesktop}>
        <AdminSidebar
          navigationItems={navigationItems}
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
            <AdminSidebar
              navigationItems={navigationItems}
              isCompact={false}
              onNavigate={closeNavigation}
              onClose={closeNavigation}
            />
          </Drawer.Body>
        </Drawer.Content>
      </Drawer.Root>
    </AppShell>
  )
}
