import { Alert, Button, Center, Loader, Stack, Text, Title } from '@mantine/core'
import cl from 'clsx'
import { useState } from 'react'
import { isAuthError, logout, retryBootstrap } from 'domains/auth'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { getBootstrapErrorMessage } from '../../helpers/get-bootstrap-error-message'
import styles from './styles/session-pending.module.css'
import type { SessionPendingProps } from './types/session-pending-props.type'

/**
 * Показывает проверку сессии и безопасные действия после её сбоя.
 *
 * Используется для:
 *  - ожидания подтверждения текущего администратора
 *  - повторной проверки или нового входа без небезопасного восстановления
 */
export const SessionPending = (props: SessionPendingProps) => {
  const { className, error, isChecking, ...rootAttrs } = props
  const [isRecovering, setIsRecovering] = useState(false)
  const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null)
  const shouldSignInAgain = error?.code === 'REFRESH_UNCERTAIN' ||
    error?.code === 'SESSION_EXPIRED' || error?.code === 'INVALID_CREDENTIALS'
  const canRecover = error?.code !== 'UNSUPPORTED_BROWSER'
  const actionLabel = shouldSignInAgain ? 'Войти заново' : 'Повторить проверку'
  const errorMessage = recoveryMessage ?? getBootstrapErrorMessage(error)

  /**
   * Повторяет только безопасную проверку либо завершает сеанс для нового входа.
   */
  const handleRecover = async (): Promise<void> => {
    if (isRecovering || !canRecover) {
      return
    }

    setIsRecovering(true)
    setRecoveryMessage(null)

    try {
      if (shouldSignInAgain) {
        await logout()
        return
      }

      await retryBootstrap()
    } catch (recoveryError) {
      if (isAuthError(recoveryError)) {
        // При выходе домен сохраняет причину для уже открытого гостевого экрана.
        if (!shouldSignInAgain && recoveryError.code !== 'SUPERSEDED') {
          setRecoveryMessage(getBootstrapErrorMessage(recoveryError))
        }

        return
      }

      reportApplicationDefect(toApplicationDefect('admin.recoverSession', recoveryError))
      setRecoveryMessage('Не удалось продолжить. Обновите страницу или повторите попытку позже.')
    } finally {
      setIsRecovering(false)
    }
  }

  if (isChecking) {
    return (
      <Center {...rootAttrs} className={cl(styles.root, className)} component="main">
        <Stack align="center" aria-busy="true" gap="md" role="status">
          <Loader aria-hidden="true" size="md" />
          <Text c="dimmed">Проверяем сеанс администратора</Text>
        </Stack>
      </Center>
    )
  }

  return (
    <Center {...rootAttrs} className={cl(styles.root, className)} component="main">
      <Stack gap="lg" maw={480} w="100%">
        <Title order={1} size="h2">Не удалось подтвердить сеанс</Title>
        <Alert color="red" title="Доступ не подтверждён">
          {errorMessage}
        </Alert>
        {canRecover && (
          <Button disabled={isRecovering} loading={isRecovering} onClick={handleRecover} variant="light">
            {actionLabel}
          </Button>
        )}
      </Stack>
    </Center>
  )
}
