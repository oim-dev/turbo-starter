import { CloseButton, NavLink, ScrollArea, Tooltip, UnstyledButton } from '@mantine/core'
import { IconHome, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconUser, IconUsers, IconKey } from '@tabler/icons-react'
import cl from 'clsx'
import type { JSX } from 'react'
import { Link, NavLink as RouterNavLink, useMatch } from 'react-router-dom'
import { usePermission } from 'domains/auth'
import { isDefined } from 'shared/value-predicates'
import type { AdminSidebarProps } from './types/admin-sidebar-props.type'
import styles from './styles/admin-sidebar.module.css'

/**
 * Предоставляет навигацию по реализованным разделам панели.
 *
 * Используется для:
 *  - перехода между экранами внутри административного каркаса
 *  - обозначения текущего раздела в полной и компактной навигации
 */
export const AdminSidebar = (props: AdminSidebarProps): JSX.Element => {
  const { isCompact, onNavigate, onToggleCompact, onClose, className, ...rootAttrs } = props
  const isHomeActive = useMatch({ path: '/', end: true }) !== null
  const isProfileActive = useMatch('/profile') !== null
  const isAccessActive = useMatch('/access') !== null
  const isKeycloakActive = useMatch('/settings/keycloak') !== null
  const canManageAccess = usePermission('system.access.manage')
  const canManageKeycloak = usePermission('system.keycloak.manage')
  const hasCloseButton = isDefined(onClose)
  const canToggleCompact = isDefined(onToggleCompact)
  const brandLabel = isCompact ? 'A' : 'Admin Panel'
  const compactLabel = isCompact ? 'Развернуть меню' : 'Свернуть меню'
  const CompactIcon = isCompact ? IconLayoutSidebarLeftExpand : IconLayoutSidebarLeftCollapse
  const compactClassName = { [styles._compact]: isCompact }
  const navClassNames = {
    body: cl(styles.navBody, compactClassName),
    section: cl(styles.navIcon, compactClassName)
  }

  return (
    <div {...rootAttrs} className={cl(styles.root, className)}>
      <div className={cl(styles.brandRow, compactClassName)}>
        <Tooltip label="Панель администратора" position="right" disabled={!isCompact} events={{ hover: true, focus: true, touch: false }}>
          <Link
            className={cl(styles.brand, compactClassName)}
            to="/"
            aria-label="Панель администратора — главная"
            onClick={onNavigate}
          >
            {brandLabel}
          </Link>
        </Tooltip>
        {hasCloseButton && (
          <CloseButton onClick={onClose} aria-label="Закрыть меню" size="lg" data-autofocus />
        )}
      </div>
      <ScrollArea className={styles.scrollArea} type="auto" offsetScrollbars>
        <nav className={styles.navigation} aria-label="Разделы админ-панели">
          <Tooltip label="Главная" position="right" disabled={!isCompact} events={{ hover: true, focus: true, touch: false }}>
            <NavLink
              component={RouterNavLink}
              className={cl(styles.navLink, compactClassName, { [styles._active]: isHomeActive })}
              classNames={navClassNames}
              end
              to="/"
              label="Главная"
              aria-label="Главная"
              leftSection={<IconHome size={21} stroke={1.7} aria-hidden="true" />}
              active={isHomeActive}
              onClick={onNavigate}
            />
          </Tooltip>
          <Tooltip label="Профиль" position="right" disabled={!isCompact} events={{ hover: true, focus: true, touch: false }}>
            <NavLink
              component={RouterNavLink}
              className={cl(styles.navLink, compactClassName, { [styles._active]: isProfileActive })}
              classNames={navClassNames}
              to="/profile"
              label="Профиль"
              aria-label="Профиль"
              leftSection={<IconUser size={21} stroke={1.7} aria-hidden="true" />}
              active={isProfileActive}
              onClick={onNavigate}
            />
          </Tooltip>
          {canManageAccess && (
            <Tooltip label="Управление доступом" position="right" disabled={!isCompact} events={{ hover: true, focus: true, touch: false }}>
              <NavLink component={RouterNavLink} className={cl(styles.navLink, compactClassName, { [styles._active]: isAccessActive })} classNames={navClassNames} to="/access" label="Управление доступом" aria-label="Управление доступом" leftSection={<IconUsers size={21} stroke={1.7} aria-hidden="true" />} active={isAccessActive} onClick={onNavigate} />
            </Tooltip>
          )}
          {canManageKeycloak && (
            <Tooltip label="Keycloak" position="right" disabled={!isCompact} events={{ hover: true, focus: true, touch: false }}>
              <NavLink component={RouterNavLink} className={cl(styles.navLink, compactClassName, { [styles._active]: isKeycloakActive })} classNames={navClassNames} to="/settings/keycloak" label="Keycloak" aria-label="Keycloak" leftSection={<IconKey size={21} stroke={1.7} aria-hidden="true" />} active={isKeycloakActive} onClick={onNavigate} />
            </Tooltip>
          )}
        </nav>
      </ScrollArea>
      {canToggleCompact && (
        <div className={styles.footer}>
          <Tooltip label={compactLabel} position="right" disabled={!isCompact} events={{ hover: true, focus: true, touch: false }}>
            <UnstyledButton
              className={cl(styles.compactButton, compactClassName)}
              onClick={onToggleCompact}
              aria-label={compactLabel}
              aria-pressed={isCompact}
              type="button"
            >
              <CompactIcon size={21} stroke={1.7} aria-hidden="true" />
              <span className={cl(styles.compactLabel, compactClassName)}>Свернуть меню</span>
            </UnstyledButton>
          </Tooltip>
        </div>
      )}
    </div>
  )
}
