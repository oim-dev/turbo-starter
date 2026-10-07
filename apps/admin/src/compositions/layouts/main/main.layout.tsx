import { AppShell } from '@mantine/core'
import { useDisclosure } from '@mantine/hooks'
import cl from 'clsx'
import { Outlet } from 'react-router-dom'

import { Content } from './parts/content'
import { Header } from './parts/header'
import { Sidebar } from './parts/sidebar'
import type { MainLayoutProps } from './types/main-layout-props.type'
import styles from './styles/main.module.css'

const HEADER_HEIGHT = 64
const NAVBAR_WIDTH = 272

/**
 * Основной каркас панели администрирования.
 *
 * Используется для:
 *  - сборки header, sidebar, content и footer
 *  - управления адаптивной навигацией
 */
export const MainLayout = (props: MainLayoutProps) => {
  const { className, ...rootAttrs } = props
  const [isNavbarOpened, { close: closeNavbar, toggle: toggleNavbar }] = useDisclosure()

  return (
    <AppShell
      {...rootAttrs}
      className={cl(styles.root, className)}
      header={{ height: HEADER_HEIGHT }}
      navbar={{
        breakpoint: 'sm',
        collapsed: { mobile: !isNavbarOpened },
        width: NAVBAR_WIDTH
      }}
      padding={0}
    >
      <Header
        isNavbarOpened={isNavbarOpened}
        onNavbarToggle={toggleNavbar}
      />
      <Sidebar onNavigate={closeNavbar} />
      <Content>
        <Outlet />
      </Content>
    </AppShell>
  )
}
