import { Alert, Button, Fieldset, Group, Modal, PasswordInput, Stack, Text } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import type { JSX } from 'react'
import { AccessError, useAccessManagement } from 'domains/admin-access'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { isDefined } from 'shared/value-predicates'
import type { AccountPasswordDialogProps, AccountPasswordValues } from './types/account-password-dialog-props.type'

/**
 * Позволяет владельцу установить новый пароль выбранного аккаунта.
 *
 * Используется для:
 *  - замены забытого пароля и включения локального способа входа
 */
export const AccountPasswordDialog = (props: AccountPasswordDialogProps): JSX.Element => {
  const { accountId, version, displayName, onClose, onSaved } = props
  const access = useAccessManagement()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const form = useForm<AccountPasswordValues>({
    mode: 'uncontrolled',
    validateInputOnBlur: true,
    initialValues: { password: '', confirmation: '' },
    validate: {
      password: (value) =>
        Array.from(value).length >= 12 && Array.from(value).length <= 128 ? null : 'От 12 до 128 символов',
      confirmation: (value, values) => (value === values.password ? null : 'Пароли не совпадают')
    }
  })

  /**
   * Отправляет новый пароль один раз и очищает форму после подтверждения.
   */
  const handleSubmit = async (values: AccountPasswordValues): Promise<void> => {
    setErrorMessage(null)
    try {
      await access.setPassword(accountId, values.password, version)
      form.reset()
      await onSaved()
    } catch (error) {
      if (error instanceof AccessError) {
        setErrorMessage(error.message)
        return
      }
      reportApplicationDefect(toApplicationDefect('user.password.set', error))
      setErrorMessage('Не удалось подтвердить изменение. Обновите данные пользователя перед повтором.')
    }
  }

  /**
   * Фокусирует первое некорректное поле.
   */
  const handleValidationError = (errors: typeof form.errors): void => {
    const first = Object.keys(errors)[0]
    if (isDefined(first)) form.getInputNode(first)?.focus()
  }

  return (
    <Modal
      opened
      title="Задать новый пароль"
      onClose={onClose}
      withCloseButton={!form.submitting}
      closeOnClickOutside={!form.submitting}
      closeOnEscape={!form.submitting}
    >
      <form noValidate onSubmit={form.onSubmit(handleSubmit, handleValidationError)}>
        <Fieldset variant="unstyled" disabled={form.submitting}>
          <Stack gap="lg">
            <Text size="sm" c="dimmed">
              Новый пароль для пользователя «{displayName}». Прежние сессии будут завершены, вход по паролю станет
              доступен.
            </Text>
            <PasswordInput
              label="Новый пароль"
              description="От 12 до 128 символов"
              required
              autoComplete="new-password"
              data-autofocus
              key={form.key('password')}
              {...form.getInputProps('password')}
            />
            <PasswordInput
              label="Повторите новый пароль"
              required
              autoComplete="new-password"
              key={form.key('confirmation')}
              {...form.getInputProps('confirmation')}
            />
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
                Сохранить пароль
              </Button>
            </Group>
          </Stack>
        </Fieldset>
      </form>
    </Modal>
  )
}
