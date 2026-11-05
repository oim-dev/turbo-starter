import { Alert, Button, Fieldset, Group, Modal, PasswordInput, Stack, Text, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconInfoCircle } from '@tabler/icons-react'
import { useState } from 'react'
import type { JSX } from 'react'
import { isAuthError, useAccountSettings } from 'domains/management/auth'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { isDefined } from 'shared/value-predicates'
import type { CredentialsDialogProps, CredentialsValues } from './types/credentials-dialog-props.type'

/**
 * Предоставляет отдельное действие смены логина или пароля.
 *
 * Используется для:
 *  - подтверждения учётных данных и завершения прежних сессий
 */
export const CredentialsDialog = (props: CredentialsDialogProps): JSX.Element => {
  const { action, login, hasLocalPassword, onClose } = props
  const settings = useAccountSettings()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const isLogin = action === 'login'
  const isPassword = action === 'password'
  const title = isLogin ? 'Изменить логин' : 'Изменить пароль'
  const form = useForm<CredentialsValues>({
    mode: 'uncontrolled',
    validateInputOnBlur: true,
    initialValues: { login, currentPassword: '', newPassword: '', confirmation: '' },
    validate: {
      login: (value) =>
        !isLogin || /^[a-zA-Z0-9_.-]{3,64}$/.test(value) ? null : 'От 3 до 64 латинских букв, цифр, _, . или -',
      currentPassword: (value) => (!hasLocalPassword || value !== '' ? null : 'Введите текущий пароль'),
      newPassword: (value) =>
        !isPassword || (Array.from(value).length >= 12 && Array.from(value).length <= 128)
          ? null
          : 'От 12 до 128 символов',
      confirmation: (value, values) => (!isPassword || value === values.newPassword ? null : 'Пароли не совпадают')
    }
  })

  /**
   * Передаёт изменение домену, который завершает прежнюю сессию.
   */
  const handleSubmit = async (values: CredentialsValues): Promise<void> => {
    setErrorMessage(null)
    try {
      if (isLogin) {
        await settings.changeLogin(values.login, hasLocalPassword ? values.currentPassword : undefined)
      } else {
        await settings.changePassword(values.currentPassword, values.newPassword)
      }
      onClose()
    } catch (error) {
      if (isAuthError(error)) {
        setErrorMessage('Не удалось выполнить изменение. Проверьте текущий пароль и доступность логина.')
        return
      }
      reportApplicationDefect(toApplicationDefect('profile.credentials', error))
      setErrorMessage('Не удалось подтвердить изменение. Проверьте состояние аккаунта перед повторной отправкой.')
    }
  }

  /**
   * Переводит фокус к первой ошибке ввода.
   */
  const handleValidationError = (errors: typeof form.errors): void => {
    const first = Object.keys(errors)[0]
    if (isDefined(first)) form.getInputNode(first)?.focus()
  }

  return (
    <Modal
      opened
      onClose={onClose}
      title={title}
      closeOnClickOutside={!form.submitting}
      closeOnEscape={!form.submitting}
      withCloseButton={!form.submitting}
    >
      <form noValidate onSubmit={form.onSubmit(handleSubmit, handleValidationError)}>
        <Fieldset variant="unstyled" disabled={form.submitting}>
          <Stack gap="lg">
            {isLogin && (
              <TextInput
                label="Новый логин"
                required
                autoComplete="username"
                data-autofocus
                key={form.key('login')}
                {...form.getInputProps('login')}
              />
            )}
            {hasLocalPassword && (
              <PasswordInput
                label="Текущий пароль"
                required
                autoComplete="current-password"
                key={form.key('currentPassword')}
                {...form.getInputProps('currentPassword')}
              />
            )}
            {isPassword && (
              <>
                <PasswordInput
                  label="Новый пароль"
                  description="От 12 до 128 символов"
                  required
                  autoComplete="new-password"
                  key={form.key('newPassword')}
                  {...form.getInputProps('newPassword')}
                />
                <PasswordInput
                  label="Повторите новый пароль"
                  required
                  autoComplete="new-password"
                  key={form.key('confirmation')}
                  {...form.getInputProps('confirmation')}
                />
              </>
            )}
            <Alert icon={<IconInfoCircle size={18} />} color="blue">
              <Text size="sm">После сохранения все ваши сессии завершатся. Войдите снова с обновлёнными данными.</Text>
            </Alert>
            {isDefined(errorMessage) && (
              <Alert color="red" role="alert">
                {errorMessage}
              </Alert>
            )}
            <Group justify="flex-end">
              <Button variant="default" onClick={onClose}>
                Отмена
              </Button>
              <Button type="submit" loading={form.submitting}>
                {title}
              </Button>
            </Group>
          </Stack>
        </Fieldset>
      </form>
    </Modal>
  )
}
