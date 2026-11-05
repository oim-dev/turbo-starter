import { Alert, Button, Divider, Stack, Text } from '@mantine/core'
import { isDefined } from 'shared/value-predicates'
import { useGetSignInMethods } from '../../hooks/use-get-sign-in-methods/use-get-sign-in-methods.hook'
import type { KeycloakSignInProps } from './types/keycloak-sign-in-props.type'

/**
 * Показывает дополнительный способ входа только при подтверждённой доступности провайдера.
 *
 * Используется для:
 *  - начала корпоративного входа через навигационный callback композиции
 *  - независимого повтора загрузки способов входа без потери локального ввода
 */
export const KeycloakSignIn = (props: KeycloakSignInProps) => {
  const { onContinue, isRedirecting } = props
  const methods = useGetSignInMethods()

  /**
   * Повторяет только безопасный GET; ошибка остаётся в публичном состоянии SWR.
   */
  const handleRetry = async (): Promise<void> => {
    await methods.mutate().catch(() => undefined)
  }

  if (isDefined(methods.error)) {
    return (
      <Alert color="yellow" title="Другие способы входа недоступны" role="status">
        <Stack gap="sm">
          <Text size="sm">Не удалось загрузить способы входа. Вход по логину и паролю по-прежнему доступен.</Text>
          <Button
            aria-label="Повторить загрузку способов входа"
            variant="light"
            onClick={handleRetry}
            loading={methods.isValidating}
            disabled={methods.isValidating}
          >
            Повторить загрузку
          </Button>
        </Stack>
      </Alert>
    )
  }

  if (methods.isLoading) {
    return <Text c="dimmed" size="sm" role="status">Проверяем другие способы входа…</Text>
  }

  if (methods.data?.hasKeycloakSignIn !== true) {
    return null
  }

  return (
    <Stack gap="md">
      <Divider label="или" labelPosition="center" />
      <Button fullWidth size="md" variant="default" onClick={onContinue} loading={isRedirecting} disabled={isRedirecting}>
        Войти через Keycloak
      </Button>
      <Text c="dimmed" size="sm" ta="center">Вы перейдёте в корпоративную систему входа.</Text>
    </Stack>
  )
}
