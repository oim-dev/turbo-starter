import { Alert, Button, Fieldset, Paper, PasswordInput, Select, Stack, Switch, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import type { JSX } from 'react'
import { AccessError, useAccessManagement } from 'domains/admin-access'
import { logout, useGetCurrentUser } from 'domains/auth'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import type { AccountEditorProps, AccountFormValues } from './types/account-editor-props.type'

/**
 * Создаёт аккаунт либо меняет его доступ по ожидаемой версии.
 *
 * Используется для:
 *  - выдачи первоначального доступа
 *  - смены роли и активности существующего аккаунта
 */
export const AccountEditor = ({ account, roles }: AccountEditorProps): JSX.Element => {
  const access = useAccessManagement()
  const currentUser = useGetCurrentUser()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const isExisting = account !== undefined
  const form = useForm<AccountFormValues>({
    mode: 'uncontrolled', validateInputOnBlur: true,
    initialValues: { login: account?.login ?? '', name: account?.name ?? '', password: '', role: account?.role ?? 'USER', isActive: account?.isActive ?? true },
    validate: {
      login: (value) => /^[a-zA-Z0-9_.-]{3,64}$/.test(value) ? null : 'От 3 до 64 латинских букв, цифр, _, . или -',
      name: (value) => value.length <= 120 ? null : 'Не больше 120 символов',
      password: (value) => isExisting || (Array.from(value).length >= 12 && Array.from(value).length <= 128) ? null : 'От 12 до 128 символов',
      role: (value) => value !== '' ? null : 'Выберите роль'
    }
  })
  const roleItems = roles.map((role) => ({ value: role.key, label: `${role.name} (${role.key})` }))
  /**
   * Сохраняет доступ; после изменения собственной роли завершает локальную сессию.
   */
  const handleSubmit = async (values: AccountFormValues): Promise<void> => {
    setErrorMessage(null)
    setIsSaved(false)
    try {
      if (account !== undefined) {
        await access.updateAccount({ id: account.id, version: account.version, role: values.role, isActive: values.isActive })
        if (account.id === currentUser.data?.id) await logout()
      } else {
        await access.createAccount({ login: values.login, name: values.name, password: values.password, role: values.role })
        form.reset()
      }
      setIsSaved(true)
    } catch (error) {
      if (error instanceof AccessError) { setErrorMessage(error.message); return }
      reportApplicationDefect(toApplicationDefect('accounts.edit', error))
      setErrorMessage('Не удалось подтвердить результат. Обновите список перед повтором.')
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
          <Fieldset variant="unstyled" miw={0} disabled={form.submitting}>
            <Stack>
              <TextInput label="Логин" required readOnly={isExisting} key={form.key('login')} {...form.getInputProps('login')} />
              <TextInput label="Имя" readOnly={isExisting} key={form.key('name')} {...form.getInputProps('name')} />
              {!isExisting && (
                <PasswordInput label="Первоначальный пароль" autoComplete="new-password" required key={form.key('password')} {...form.getInputProps('password')} />
              )}
              <Select label="Роль" required searchable allowDeselect={false} data={roleItems} key={form.key('role')} {...form.getInputProps('role')} />
              {isExisting && (
                <Switch label="Аккаунт активен" key={form.key('isActive')} {...form.getInputProps('isActive', { type: 'checkbox' })} />
              )}
              <Button type="submit" loading={form.submitting}>Сохранить аккаунт</Button>
            </Stack>
          </Fieldset>
          {errorMessage !== null && (
            <Alert color="red" role="alert">{errorMessage}</Alert>
          )}
          {isSaved && (
            <Alert color="green" role="status">Аккаунт сохранён.</Alert>
          )}
        </Stack>
      </form>
    </Paper>
  )
}
