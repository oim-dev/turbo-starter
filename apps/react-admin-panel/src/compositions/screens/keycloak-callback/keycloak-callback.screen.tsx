import { Alert, Button, Card, Loader, Stack, Text, Title } from '@mantine/core'
import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  getSignInErrorMessage,
  isAuthError,
  mapKeycloakCallbackError,
  signInWithKeycloakCompletion
} from 'domains/management/auth'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { getSafeReturnTo } from 'shared/navigation'
import { isDefined } from 'shared/value-predicates'
import styles from './styles/keycloak-callback.module.css'

/**
 * Завершает одноразовый вход вне гостевых и приватных ограничений маршрута.
 *
 * Используется для:
 *  - ожидания подтверждённой сессии и безопасного возврата в панель
 *  - объяснимого отказа без повторного использования completion cookie
 */
export const KeycloakCallbackScreen = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const [completionError, setCompletionError] = useState<string | null>(null)
  const parameters = new URLSearchParams(location.search)
  const hasSuccess = parameters.getAll('result').length === 1 && parameters.get('result') === 'success' &&
    !parameters.has('error')
  const returnTo = getSafeReturnTo(parameters.get('returnTo'))
  const callbackOutcome = hasSuccess ? null : mapKeycloakCallbackError(parameters.get('error'))
  const isAccessDenied = callbackOutcome?.code === 'KEYCLOAK_INACTIVE'
  const callbackError = isDefined(callbackOutcome) ? getSignInErrorMessage(callbackOutcome) : null
  const errorMessage = callbackError ?? completionError
  const heading = isAccessDenied ? 'Вход в панель не разрешён' : 'Вход не завершён'
  const messageTitle = isAccessDenied ? 'Доступ к учётной записи закрыт' : 'Не удалось войти через Keycloak'
  const messageColor = isAccessDenied ? 'blue' : 'red'
  const returnLabel = isAccessDenied ? 'Вернуться к входу' : 'Начать вход заново'

  useEffect(() => {
    if (!hasSuccess) {
      return
    }

    let isActive = true
    void signInWithKeycloakCompletion().then(() => {
      if (isActive) {
        void navigate(returnTo, { replace: true })
      }
    }).catch((error: unknown) => {
      if (!isActive) {
        return
      }
      if (isAuthError(error)) {
        setCompletionError(getSignInErrorMessage(error))
        return
      }
      reportApplicationDefect(toApplicationDefect('keycloak.callback', error))
      setCompletionError('Не удалось завершить вход. Начните вход заново или обратитесь к администратору.')
    })

    return () => { isActive = false }
  }, [hasSuccess, navigate, returnTo])

  if (isDefined(errorMessage)) {
    return (
      <main className={styles.root}>
        <Card className={styles.card} padding="xl" radius="md" withBorder>
          <Stack gap="lg">
            <Title order={1} size="h2">{heading}</Title>
            <Alert color={messageColor} title={messageTitle} role="alert">{errorMessage}</Alert>
            <Button
              aria-label="Вернуться к способам входа"
              component={Link}
              replace
              state={{ returnTo }}
              to="/sign-in"
              fullWidth
            >
              {returnLabel}
            </Button>
          </Stack>
        </Card>
      </main>
    )
  }

  return (
    <main className={styles.root} aria-busy="true">
      <Card className={styles.card} padding="xl" radius="md" withBorder>
        <Stack gap="lg">
          <Title order={1} size="h2">Завершаем вход</Title>
          <Loader aria-hidden="true" />
          <Text role="status">Подтверждаем вход через Keycloak. Не закрывайте эту страницу.</Text>
        </Stack>
      </Card>
    </main>
  )
}
