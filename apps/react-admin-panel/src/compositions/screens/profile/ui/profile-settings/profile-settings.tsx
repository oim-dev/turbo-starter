import { Alert, Button, Fieldset, Paper, PasswordInput, Select, Stack, Text, TextInput, Title } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import type { JSX } from 'react'
import { isAuthError, useAccountSettings } from 'domains/auth'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { isEmptyArray } from 'shared/value-predicates'
import type { ProfileSettingsProps, ProfileSettingsValues } from './types/profile-settings-props.type'

/**
 * Предоставляет действия над собственным профилем и credentials.
 *
 * Используется для:
 *  - изменения имени
 *  - смены логина и пароля с завершением прежних сессий
 */
export const ProfileSettings = ({ profile }: ProfileSettingsProps): JSX.Element => {
  const settings = useAccountSettings()
  const [action, setAction] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const canChangeName = profile.permissions.includes('account.update')
  const canChangeLogin = profile.permissions.includes('account.login.change')
  const canChangePassword = profile.hasLocalPassword && profile.permissions.includes('account.password.change')
  const actionItems = [
    { value: 'name', label: 'Изменить имя', isAllowed: canChangeName },
    { value: 'login', label: 'Сменить логин', isAllowed: canChangeLogin },
    { value: 'password', label: 'Сменить пароль', isAllowed: canChangePassword }
  ].filter((entry) => entry.isAllowed)
  const currentAction = action ?? actionItems[0]?.value
  const isNameAction = currentAction === 'name'
  const isLoginAction = currentAction === 'login'
  const isPasswordAction = currentAction === 'password'
  const needsPassword = !isNameAction && profile.hasLocalPassword
  const form = useForm<ProfileSettingsValues>({
    mode: 'uncontrolled', validateInputOnBlur: true,
    initialValues: { name: profile.name, login: profile.login, currentPassword: '', newPassword: '' },
    validate: {
      name: (value) => !isNameAction || value.length <= 120 ? null : 'Не больше 120 символов',
      login: (value) => !isLoginAction || /^[a-zA-Z0-9_.-]{3,64}$/.test(value) ? null : 'От 3 до 64 латинских букв, цифр, _, . или -',
      currentPassword: (value) => !needsPassword || value.length > 0 ? null : 'Введите текущий пароль',
      newPassword: (value) => !isPasswordAction || (Array.from(value).length >= 12 && Array.from(value).length <= 128) ? null : 'От 12 до 128 символов'
    }
  })
  /**
   * Выполняет выбранное действие через доменный lifecycle.
   */
  const handleSubmit = async (values: ProfileSettingsValues): Promise<void> => {
    setErrorMessage(null)
    setIsSaved(false)
    try {
      if (isNameAction) await settings.updateName(values.name)
      if (isLoginAction) await settings.changeLogin(values.login, needsPassword ? values.currentPassword : undefined)
      if (isPasswordAction) await settings.changePassword(values.currentPassword, values.newPassword)
      form.setFieldValue('currentPassword', '')
      form.setFieldValue('newPassword', '')
      setIsSaved(true)
    } catch (error) {
      if (isAuthError(error)) { setErrorMessage('Не удалось выполнить действие. Проверьте текущий пароль, доступность логина и состояние сессии.'); return }
      reportApplicationDefect(toApplicationDefect('profile.update', error))
      setErrorMessage('Не удалось подтвердить изменение. Обновите профиль перед повтором.')
    }
  }
  /**
   * Фокусирует первое некорректное поле.
   */
  const handleValidationError = (errors: typeof form.errors): void => {
    const first = Object.keys(errors)[0]
    if (first !== undefined) form.getInputNode(first)?.focus()
  }
  if (isEmptyArray(actionItems)) return <Text c="dimmed">Для этой роли доступен только просмотр профиля.</Text>
  return (
    <Paper p="lg" withBorder>
      <form noValidate onSubmit={form.onSubmit(handleSubmit, handleValidationError)}>
        <Stack>
          <Title order={2} size="h3">Настройки аккаунта</Title>
          <Fieldset variant="unstyled" miw={0} disabled={form.submitting}>
            <Stack>
              <Select label="Действие" data={actionItems} value={currentAction ?? null} allowDeselect={false} onChange={setAction} />
              {isNameAction && (
                <TextInput label="Имя" key={form.key('name')} {...form.getInputProps('name')} />
              )}
              {isLoginAction && (
                <TextInput label="Новый логин" required key={form.key('login')} {...form.getInputProps('login')} />
              )}
              {needsPassword && (
                <PasswordInput label="Текущий пароль" required autoComplete="current-password" key={form.key('currentPassword')} {...form.getInputProps('currentPassword')} />
              )}
              {isPasswordAction && (
                <PasswordInput label="Новый пароль" required autoComplete="new-password" key={form.key('newPassword')} {...form.getInputProps('newPassword')} />
              )}
              <Button type="submit" loading={form.submitting}>Сохранить</Button>
            </Stack>
          </Fieldset>
          {!isNameAction && (
            <Text size="sm" c="dimmed">После смены логина или пароля все ваши сессии завершатся. Потребуется новый вход.</Text>
          )}
          {errorMessage !== null && (
            <Alert color="red" role="alert">{errorMessage}</Alert>
          )}
          {isSaved && (
            <Alert color="green" role="status">Изменения сохранены.</Alert>
          )}
        </Stack>
      </form>
    </Paper>
  )
}
