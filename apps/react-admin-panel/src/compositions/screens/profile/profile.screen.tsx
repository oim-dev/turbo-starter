import { Alert, Badge, Button, Loader, Paper, Stack, Text, Title } from '@mantine/core'
import cl from 'clsx'
import type { JSX } from 'react'
import { isAuthError, useGetCurrentUser } from 'domains/auth'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { isDefined } from 'shared/value-predicates'
import { formatProfileTimestamp } from './helpers/format-profile-timestamp'
import { getProfileErrorMessage } from './helpers/get-profile-error-message'
import type { ProfileScreenProps } from './types/profile-screen-props.type'
import styles from './styles/profile.module.css'

/**
 * Показывает подтверждённые сервером сведения о текущем администраторе без редактирования.
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

  if (isPending) {
    return (
      <section {...rootAttrs} className={rootClassName} aria-busy="true">
        <Stack gap="lg">
          <Title order={1}>Профиль</Title>
          <Loader aria-hidden="true" />
          <Text role="status" c="dimmed">Загружаем профиль администратора…</Text>
        </Stack>
      </section>
    )
  }

  if (isDefined(profileError) || !isDefined(profileData)) {
    const errorMessage = getProfileErrorMessage(profileError)

    return (
      <section {...rootAttrs} className={rootClassName}>
        <Stack gap="lg">
          <Title order={1}>Профиль</Title>
          <Alert color="red" title="Не удалось загрузить профиль">{errorMessage}</Alert>
          <Button onClick={handleRetry} loading={currentUser.isValidating} disabled={currentUser.isValidating}>
            Повторить загрузку
          </Button>
        </Stack>
      </section>
    )
  }

  const roleLabel = profileData.role === 'OWNER' ? 'Владелец' : 'Поддержка'
  const activityLabel = profileData.isActive ? 'Активна' : 'Неактивна'
  const activityColor = profileData.isActive ? 'green' : 'gray'
  const createdAtLabel = formatProfileTimestamp(profileData.createdAt)
  const updatedAtLabel = formatProfileTimestamp(profileData.updatedAt)

  return (
    <section {...rootAttrs} className={rootClassName}>
      <Stack gap="xl">
        <Stack gap="xs">
          <Title order={1}>Профиль</Title>
          <Text c="dimmed">Сведения о вашей учётной записи. Доступны только для просмотра.</Text>
        </Stack>
        <Paper p="xl" radius="md" withBorder>
          <dl className={styles.details}>
            <dt className={styles.label}>Логин</dt>
            <dd className={styles.value}>{profileData.login}</dd>
            <dt className={styles.label}>Роль</dt>
            <dd className={styles.value}>{roleLabel}</dd>
            <dt className={styles.label}>Учётная запись</dt>
            <dd className={styles.value}><Badge color={activityColor} variant="light">{activityLabel}</Badge></dd>
            <dt className={styles.label}>Идентификатор</dt>
            <dd className={styles.value}>{profileData.id}</dd>
            <dt className={styles.label}>Создана</dt>
            <dd className={styles.value}><time dateTime={profileData.createdAt}>{createdAtLabel}</time></dd>
            <dt className={styles.label}>Обновлена</dt>
            <dd className={styles.value}><time dateTime={profileData.updatedAt}>{updatedAtLabel}</time></dd>
          </dl>
        </Paper>
      </Stack>
    </section>
  )
}
