import { Anchor, Breadcrumbs, Text } from '@mantine/core'
import { IconChevronRight } from '@tabler/icons-react'
import cl from 'clsx'
import type { JSX } from 'react'
import { Link, useMatch } from 'react-router-dom'
import styles from './styles/admin-breadcrumbs.module.css'

/**
 * Показывает контекст текущего раздела и путь к родительским страницам.
 *
 * Используется для:
 *  - возврата из профиля на главную
 *  - компактного названия текущего экрана на телефоне
 */
export const AdminBreadcrumbs = (): JSX.Element => {
  const isProfile = useMatch('/profile') !== null
  const currentLabel = isProfile ? 'Профиль' : 'Главная'

  return (
    <nav className={styles.root} aria-label="Хлебные крошки">
      <Breadcrumbs separator={<IconChevronRight size={13} aria-hidden="true" />} visibleFrom="sm">
        {isProfile && (
          <Anchor component={Link} className={styles.crumb} to="/" size="sm">Главная</Anchor>
        )}
        <Text className={cl(styles.crumb, styles._current)} size="sm" aria-current="page">
          {currentLabel}
        </Text>
      </Breadcrumbs>
      <Text className={styles.currentLabel} size="sm" fw={600} truncate hiddenFrom="sm" aria-current="page">
        {currentLabel}
      </Text>
    </nav>
  )
}
