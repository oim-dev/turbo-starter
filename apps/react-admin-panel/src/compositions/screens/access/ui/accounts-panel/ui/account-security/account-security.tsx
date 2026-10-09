import { Alert, Button, Fieldset, Group, Paper, Stack, Text, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import type { JSX } from 'react'
import { AccessError, useAccessManagement } from 'domains/admin-access'
import { isAuthError, logout, useGetCurrentUser } from 'domains/auth'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { isEmptyArray } from 'shared/value-predicates'
import type { AccountSecurityProps, IdentityFormValues } from './types/account-security-props.type'
import styles from './styles/account-security.module.css'

/**
 * Управляет внешними привязками и сессиями выбранного аккаунта.
 *
 * Используется для:
 *  - привязки и отзыва пользователей Keycloak
 *  - отключения локального пароля и завершения сессий
 */
export const AccountSecurity = ({ account }: AccountSecurityProps): JSX.Element => {
  const access = useAccessManagement()
  const currentUser = useGetCurrentUser()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isActing, setIsActing] = useState(false)
  const form = useForm<IdentityFormValues>({
    mode: 'uncontrolled',
    validateInputOnBlur: true,
    initialValues: { issuer: '', subject: '' },
    validate: {
      issuer: (value) => /^https?:\/\//.test(value) && value.length <= 512 ? null : 'Введите issuer realm',
      subject: (value) => value.trim() !== '' && value.length <= 255 ? null : 'Введите точный sub (до 255 символов)'
    }
  })
  const isDisabled = form.submitting || isActing
  const identityItems = account.identities
  const hasNoIdentities = isEmptyArray(identityItems)
  const canDisablePassword = account.hasLocalPassword && (!account.isActive || !hasNoIdentities)
  const passwordLabel = account.hasLocalPassword ? 'Локальный пароль включён.' : 'Локальный пароль отключён.'

  /**
   * Завершает собственную локальную сессию после серверного отзыва.
   */
  const finishChange = async (): Promise<void> => {
    if (account.id === currentUser.data?.id) await logout()
  }

  /**
   * Показывает ожидаемый отказ, а неизвестный сбой передаёт в диагностику.
   */
  const handleFailure = (error: unknown): void => {
    if (error instanceof AccessError) { setErrorMessage(error.message); return }
    if (isAuthError(error)) { setErrorMessage('Сессия завершена. Войдите снова.'); return }
    reportApplicationDefect(toApplicationDefect('account-security.change', error))
    setErrorMessage('Не удалось подтвердить изменение. Обновите страницу перед повтором.')
  }

  /**
   * Привязывает известного пользователя провайдера к выбранному аккаунту.
   */
  const handleBind = async (values: IdentityFormValues): Promise<void> => {
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await access.bindIdentity(account.id, values)
      form.reset()
      setSuccessMessage('Привязка сохранена. Прежние сессии аккаунта отозваны.')
      await finishChange()
    } catch (error) { handleFailure(error) }
  }

  /**
   * Выполняет отдельное действие над доступом без повторной отправки.
   */
  const handleAction = async (operation: () => Promise<void>): Promise<void> => {
    setIsActing(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await operation()
      setSuccessMessage('Изменение применено. Прежние сессии аккаунта отозваны.')
      await finishChange()
    } catch (error) { handleFailure(error) } finally { setIsActing(false) }
  }

  /**
   * Фокусирует первое некорректное поле привязки.
   */
  const handleValidationError = (errors: typeof form.errors): void => {
    const first = Object.keys(errors)[0]
    if (first !== undefined) form.getInputNode(first)?.focus()
  }

  return (
    <Paper className={styles.root} withBorder p="lg">
      <Stack>
        <Title order={2} size="h3">Способы входа и сессии</Title>
        <Text size="sm" c="dimmed">Привязка выполняется по issuer и sub из Keycloak. Email и логин провайдера для этого не подходят.</Text>
        {hasNoIdentities && (
          <Text c="dimmed">Привязок Keycloak пока нет.</Text>
        )}
        {identityItems.map((identity) => (
          <Paper key={identity.id} withBorder p="sm">
            <Stack gap="xs">
              <Text className={styles.identityValue} size="sm">Issuer: {identity.issuer}</Text>
              <Text className={styles.identityValue} size="sm">Sub: {identity.subject}</Text>
              <Button variant="light" color="red" disabled={isDisabled} onClick={() => { void handleAction(() => access.unbindIdentity(account.id, identity.id)) }}>Отозвать привязку</Button>
            </Stack>
          </Paper>
        ))}
        <form noValidate onSubmit={form.onSubmit(handleBind, handleValidationError)}>
          <Fieldset variant="unstyled" miw={0} disabled={isDisabled}>
            <Stack>
              <TextInput label="Issuer привязки" placeholder="https://sso.example.org/realms/company" required key={form.key('issuer')} {...form.getInputProps('issuer')} />
              <TextInput label="Subject (sub) пользователя Keycloak" required key={form.key('subject')} {...form.getInputProps('subject')} />
              <Button type="submit" loading={form.submitting}>Привязать Keycloak</Button>
            </Stack>
          </Fieldset>
        </form>
        <Text size="sm">{passwordLabel}</Text>
        <Group>
          {account.hasLocalPassword && (
            <Button variant="light" color="orange" disabled={isDisabled || !canDisablePassword} onClick={() => { void handleAction(() => access.disablePassword(account.id)) }}>Отключить локальный пароль</Button>
          )}
          <Button variant="light" color="red" disabled={isDisabled} onClick={() => { void handleAction(() => access.revokeSessions(account.id)) }}>Завершить все сессии</Button>
        </Group>
        {errorMessage !== null && (
          <Alert color="red" role="alert">{errorMessage}</Alert>
        )}
        {successMessage !== null && (
          <Alert color="green" role="status">{successMessage}</Alert>
        )}
      </Stack>
    </Paper>
  )
}
