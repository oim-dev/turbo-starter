import { Alert, Button, Checkbox, Fieldset, Paper, PasswordInput, Stack, Switch, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import type { JSX } from 'react'
import { KeycloakSettingsError, useKeycloakSettings } from 'domains/keycloak-settings'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import type { KeycloakFormProps, KeycloakFormValues } from './types/keycloak-form-props.type'

/**
 * Редактирует конфигурацию OIDC и передаёт secret только при явной замене.
 *
 * Используется для:
 *  - сохранения черновика и включения провайдера
 *  - замены или удаления сохранённого секрета
 */
export const KeycloakForm = ({ settings, onSaved }: KeycloakFormProps): JSX.Element => {
  const configuration = useKeycloakSettings()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const form = useForm<KeycloakFormValues>({
    mode: 'uncontrolled', validateInputOnBlur: true,
    initialValues: {
      enabled: settings.enabled,
      issuer: settings.issuer,
      clientId: settings.clientId,
      clientSecret: '',
      clearSecret: false,
      callbackUrl: settings.callbackUrl,
      frontendCallbackUrl: settings.frontendCallbackUrl
    },
    validate: {
      issuer: (value, values) => values.enabled && value.trim() === '' ? 'Введите issuer realm' : null,
      clientId: (value, values) => values.enabled && value.trim() === '' ? 'Введите Client ID' : null,
      clientSecret: (value, values) => values.enabled && ((!settings.hasSecret && value === '') || values.clearSecret) ? 'Для включения требуется сохранённый или новый secret' : null,
      callbackUrl: (value, values) => values.enabled && value.trim() === '' ? 'Введите backend callback URL' : null,
      frontendCallbackUrl: (value, values) => values.enabled && value.trim() === '' ? 'Введите frontend callback URL' : null
    }
  })
  const secretDescription = settings.hasSecret ? 'Секрет сохранён. Оставьте поле пустым, чтобы его не менять.' : 'Секрет ещё не задан.'
  /**
   * Отправляет текущую версию и очищает секрет после подтверждённой записи.
   */
  const handleSubmit = async (values: KeycloakFormValues): Promise<void> => {
    setErrorMessage(null)
    try {
      await configuration.save({
        enabled: values.enabled,
        issuer: values.issuer,
        clientId: values.clientId,
        callbackUrl: values.callbackUrl,
        frontendCallbackUrl: values.frontendCallbackUrl,
        clientSecret: values.clientSecret || undefined,
        clearSecret: values.clearSecret,
        version: settings.version
      })
      form.setFieldValue('clientSecret', '')
      onSaved()
    } catch (error) {
      if (error instanceof KeycloakSettingsError) { setErrorMessage(error.message); return }
      reportApplicationDefect(toApplicationDefect('keycloak-settings.form', error))
      setErrorMessage('Не удалось подтвердить сохранение. Обновите страницу перед повтором.')
    }
  }
  /**
   * Фокусирует первое некорректное поле.
   */
  const handleValidationError = (errors: typeof form.errors): void => {
    const first = Object.keys(errors)[0]
    if (first !== undefined) form.getInputNode(first)?.focus()
  }
  return (
    <Paper withBorder p="lg">
      <form noValidate onSubmit={form.onSubmit(handleSubmit, handleValidationError)}>
        <Stack>
          {!settings.canStoreSecret && (
            <Alert color="yellow">Для сохранения secret задайте на сервере ADMIN_SETTINGS_ENCRYPTION_KEY: 32 случайных байта в base64. Настройки подключения вводятся здесь.</Alert>
          )}
          <Fieldset variant="unstyled" miw={0} disabled={form.submitting}>
            <Stack>
              <Switch label="Разрешить вход через Keycloak" key={form.key('enabled')} {...form.getInputProps('enabled', { type: 'checkbox' })} />
              <TextInput label="Issuer URL" placeholder="https://sso.example.org/realms/company" key={form.key('issuer')} {...form.getInputProps('issuer')} />
              <TextInput label="Client ID" key={form.key('clientId')} {...form.getInputProps('clientId')} />
              <PasswordInput label="Новый Client Secret" description={secretDescription} autoComplete="new-password" disabled={!settings.canStoreSecret} key={form.key('clientSecret')} {...form.getInputProps('clientSecret')} />
              <Checkbox label="Удалить сохранённый secret (при отключённом Keycloak)" key={form.key('clearSecret')} {...form.getInputProps('clearSecret', { type: 'checkbox' })} />
              <TextInput label="Backend callback URL" placeholder="https://admin.example.org/api/auth/keycloak/callback" key={form.key('callbackUrl')} {...form.getInputProps('callbackUrl')} />
              <TextInput label="Frontend callback URL" placeholder="https://admin.example.org/auth/keycloak/callback" key={form.key('frontendCallbackUrl')} {...form.getInputProps('frontendCallbackUrl')} />
              <Text size="sm" c="dimmed">Срок административной сессии — 7 дней без продления, независимо от способа входа.</Text>
              <Button type="submit" loading={form.submitting}>Сохранить настройки</Button>
            </Stack>
          </Fieldset>
          <Text size="sm" c="dimmed">При включении сервер проверит discovery провайдера. Это не заменяет проверку реального входа и привязки issuer + sub к аккаунту. Сохранение отзывает SSO-сессии, включая текущую, если вы вошли через Keycloak.</Text>
          {errorMessage !== null && (
            <Alert color="red" role="alert">{errorMessage}</Alert>
          )}
        </Stack>
      </form>
    </Paper>
  )
}
