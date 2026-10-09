import { Alert, Button, Fieldset, Group, MultiSelect, Paper, Stack, TextInput } from '@mantine/core'
import { useForm } from '@mantine/form'
import { useState } from 'react'
import type { JSX } from 'react'
import { AccessError, useAccessManagement } from 'domains/admin-access'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import type { RoleEditorProps, RoleFormValues } from './types/role-editor-props.type'

/**
 * Редактирует права дополнительной роли и показывает встроенные роли.
 *
 * Используется для:
 *  - создания и сохранения роли
 *  - удаления неназначенной дополнительной роли
 */
export const RoleEditor = ({ role, permissions, onDeleted }: RoleEditorProps): JSX.Element => {
  const access = useAccessManagement()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const form = useForm<RoleFormValues>({
    mode: 'uncontrolled', validateInputOnBlur: true,
    initialValues: { key: role?.key ?? '', name: role?.name ?? '', permissions: role?.permissions ?? ['account.read'] },
    validate: {
      key: (value) => /^[A-Z][A-Z0-9_]{2,63}$/.test(value) ? null : 'От 3 до 64: заглавные латинские буквы, цифры и _',
      name: (value) => value.trim().length > 0 && value.length <= 120 ? null : 'Введите название до 120 символов',
      permissions: (values) => values.includes('account.read') ? null : 'Для входа в панель требуется account.read'
    }
  })
  const isBuiltin = role?.isBuiltin === true
  const isExisting = role !== undefined
  const isDisabled = isBuiltin || form.submitting || isDeleting
  const canDelete = isExisting && !isBuiltin
  const permissionItems = permissions.filter((permission) => isBuiltin || !permission.system).map((permission) => ({ value: permission.key, label: `${permission.name} (${permission.key})` }))
  /**
   * Отделяет ожидаемый отказ от дефекта приложения.
   */
  const handleError = (error: unknown): void => {
    if (error instanceof AccessError) { setErrorMessage(error.message); return }
    reportApplicationDefect(toApplicationDefect('roles.edit', error))
    setErrorMessage('Не удалось подтвердить изменение. Обновите список перед повтором.')
  }
  /**
   * Сохраняет выбранную роль без автоматического повторения запроса.
   */
  const handleSubmit = async (values: RoleFormValues): Promise<void> => {
    setErrorMessage(null)
    setIsSaved(false)
    try {
      await access.saveRole(values, role?.version)
      setIsSaved(true)
      if (!isExisting) form.reset()
    } catch (error) { handleError(error) }
  }
  /**
   * Удаляет роль после явного пользовательского действия.
   */
  const handleDelete = async (): Promise<void> => {
    if (role === undefined) return
    setIsDeleting(true)
    setErrorMessage(null)
    try { await access.deleteRole(role.key); onDeleted() } catch (error) { handleError(error) } finally { setIsDeleting(false) }
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
          <Fieldset variant="unstyled" miw={0} disabled={isDisabled}>
            <Stack>
              <TextInput label="Ключ роли" required readOnly={isExisting} key={form.key('key')} {...form.getInputProps('key')} />
              <TextInput label="Название" required key={form.key('name')} {...form.getInputProps('name')} />
              <MultiSelect label="Permissions" searchable data={permissionItems} key={form.key('permissions')} {...form.getInputProps('permissions')} />
              <Button type="submit" loading={form.submitting} disabled={isBuiltin}>Сохранить роль</Button>
            </Stack>
          </Fieldset>
          {errorMessage !== null && (
            <Alert color="red" role="alert">{errorMessage}</Alert>
          )}
          {isSaved && (
            <Alert color="green" role="status">Роль сохранена.</Alert>
          )}
          {canDelete && (
            <Group><Button color="red" variant="light" type="button" loading={isDeleting} disabled={form.submitting} onClick={handleDelete}>Удалить неназначенную роль</Button></Group>
          )}
        </Stack>
      </form>
    </Paper>
  )
}
