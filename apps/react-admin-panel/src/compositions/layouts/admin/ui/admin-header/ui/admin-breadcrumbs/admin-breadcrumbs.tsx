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
  const isImages = useMatch('/images') !== null
  const isFiles = useMatch('/files') !== null
  const isManagement = useMatch('/management') !== null
  const isUsers = useMatch('/management/users/*') !== null
  const isNewUser = useMatch('/management/users/new') !== null
  const isUserDetails = useMatch('/management/users/:accountId') !== null
  const hasUsersParent = isNewUser || isUserDetails
  const isRoles = useMatch('/management/roles/*') !== null
  const isPermissions = useMatch('/management/permissions') !== null
  const isKeycloak = useMatch('/management/keycloak') !== null
  const isManagementSection = isUsers || isRoles || isPermissions || isKeycloak
  const parentLabel = isManagementSection ? 'Панель управления' : 'Главная'
  const parentPath = isManagementSection ? '/management' : '/'
  const hasParent = isProfile || isImages || isFiles || isManagementSection
  let currentLabel = 'Главная'
  if (isManagement) currentLabel = 'Панель управления'
  if (isProfile) currentLabel = 'Мой профиль'
  if (isImages) currentLabel = 'Изображения'
  if (isFiles) currentLabel = 'Файлы'
  if (isUsers) currentLabel = 'Команда'
  if (isUserDetails) currentLabel = 'Пользователь'
  if (isNewUser) currentLabel = 'Новый пользователь'
  if (isRoles) currentLabel = 'Роли'
  if (isPermissions) currentLabel = 'Права доступа'
  if (isKeycloak) currentLabel = 'Корпоративный вход'

  return (
    <nav className={styles.root} aria-label="Хлебные крошки">
      <Breadcrumbs separator={<IconChevronRight size={13} aria-hidden="true" />} visibleFrom="sm">
        {hasParent && (
          <Anchor component={Link} className={styles.crumb} to={parentPath} size="sm">
            {parentLabel}
          </Anchor>
        )}
        {hasUsersParent && (
          <Anchor component={Link} className={styles.crumb} to="/management/users" size="sm">
            Команда
          </Anchor>
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
