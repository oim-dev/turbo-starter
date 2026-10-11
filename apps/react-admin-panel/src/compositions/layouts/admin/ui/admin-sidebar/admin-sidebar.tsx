import { CloseButton, NavLink, ScrollArea, Tooltip, UnstyledButton } from '@mantine/core'
import { IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand } from '@tabler/icons-react'
import cl from 'clsx'
import type { JSX } from 'react'
import { Link, NavLink as RouterNavLink, useLocation } from 'react-router-dom'
import { AppIcon } from 'infra/app-icons'
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
  const { navigationItems, isCompact, onNavigate, onToggleCompact, onClose, className, ...rootAttrs } = props
  const { pathname } = useLocation()
  const hasCloseButton = isDefined(onClose)
  const canToggleCompact = isDefined(onToggleCompact)
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
        <Tooltip
          label="BIOCAD — панель администратора"
          position="right"
          disabled={!isCompact}
          events={{ hover: true, focus: true, touch: false }}
        >
          <Link
            className={styles.brand}
            to="/"
            aria-label="BIOCAD — главная страница админки"
            onClick={onNavigate}
          >
            <AppIcon
              icon="biocad-logo"
              width={124}
              height={24}
              className={cl(styles.brandLogo, compactClassName)}
              aria-hidden="true"
            />
          </Link>
        </Tooltip>
        {hasCloseButton && <CloseButton onClick={onClose} aria-label="Закрыть меню" size="lg" data-autofocus />}
      </div>
      <ScrollArea className={styles.scrollArea} type="auto" offsetScrollbars>
        <nav className={styles.navigation} aria-label="Разделы админ-панели">
          {navigationItems.map((entry) => {
            const isExactMatch = pathname === entry.to
            const isActive = entry.end === true ? isExactMatch : isExactMatch || pathname.startsWith(`${entry.to}/`)
            const EntryIcon = entry.icon
            return (
              <Tooltip
                key={entry.to}
                label={entry.label}
                position="right"
                disabled={!isCompact}
                events={{ hover: true, focus: true, touch: false }}
              >
                <NavLink
                  component={RouterNavLink}
                  className={cl(styles.navLink, compactClassName, { [styles._active]: isActive })}
                  classNames={navClassNames}
                  to={entry.to}
                  end={entry.end}
                  label={entry.label}
                  aria-label={entry.label}
                  leftSection={<EntryIcon size={20} stroke={1.7} aria-hidden="true" />}
                  active={isActive}
                  onClick={onNavigate}
                />
              </Tooltip>
            )
          })}
        </nav>
      </ScrollArea>
      {canToggleCompact && (
        <div className={styles.footer}>
          <Tooltip
            label={compactLabel}
            position="right"
            disabled={!isCompact}
            events={{ hover: true, focus: true, touch: false }}
          >
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
