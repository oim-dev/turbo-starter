import { Avatar, Badge, Group, Paper, Text } from '@mantine/core'
import cl from 'clsx'
import type { JSX } from 'react'
import { isAuthError, useGetCurrentUser } from 'domains/auth'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { isDefined } from 'shared/value-predicates'
import { PageHeading } from 'ui/page-heading'
import { QueryState } from 'ui/query-state'
import type { ProfileScreenProps } from './types/profile-screen-props.type'
import styles from './styles/profile.module.css'
import { ProfileSettings } from './ui/profile-settings/profile-settings'

/**
 * Показывает подтверждённый профиль и доступные действия собственного аккаунта.
 *
 * Используется для:
 *  - просмотра профиля внутри защищённого административного каркаса
 *  - повторной загрузки профиля после временной недоступности API
 */
export const ProfileScreen = (props: ProfileScreenProps): JSX.Element => {
  const { className, ...rootAttrs } = props
  const currentUser = useGetCurrentUser()
  const profileData = currentUser.data
  const profileError = currentUser.error
  const isPending = currentUser.isLoading || (!isDefined(profileData) && !isDefined(profileError))
  const rootClassName = cl(styles.root, className)

  /**
   * Повторяет GET в текущем приватном кеше без обхода доменного контракта.
   */
  const handleRetry = async (): Promise<void> => {
    try {
      await currentUser.mutate()
    } catch (error) {
      if (!isAuthError(error)) {
        reportApplicationDefect(toApplicationDefect('profile.reload', error))
      }
    }
  }

  if (isPending || isDefined(profileError) || !isDefined(profileData)) {
    return (
      <section {...rootAttrs} className={rootClassName}>
        <PageHeading
          eyebrow="Личный аккаунт"
          title="Мой профиль"
          description="Ваши данные, безопасность и доступ к рабочему пространству."
        />
        <QueryState isLoading={isPending} title="Не удалось загрузить профиль" onRetry={handleRetry} />
      </section>
    )
  }

  const displayName = profileData.name.trim() || profileData.login
  const activityLabel = profileData.isActive ? 'Аккаунт активен' : 'Аккаунт отключён'
  const activityColor = profileData.isActive ? 'teal' : 'gray'

  return (
    <section {...rootAttrs} className={rootClassName}>
      <PageHeading
        eyebrow="Личный аккаунт"
        title="Мой профиль"
        description="Ваши данные, безопасность и доступ к рабочему пространству."
      />
      <Paper withBorder className={styles.identity}>
        <Group gap="lg" wrap="nowrap">
          <Avatar size={64} radius={20} name={displayName} color="brand" />
          <div className={styles.identityCopy}>
            <Text className={styles.name}>{displayName}</Text>
            <Text c="dimmed" size="sm" className={styles.login}>
              @{profileData.login}
            </Text>
          </div>
        </Group>
        <Group gap="sm">
          <Badge color="gray" size="lg">
            {profileData.roleName}
          </Badge>
          <Badge color={activityColor} variant="dot" size="lg">
            {activityLabel}
          </Badge>
        </Group>
      </Paper>
      <ProfileSettings key={profileData.id} profile={profileData} />
    </section>
  )
}
