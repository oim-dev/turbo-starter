import {
  Alert,
  Anchor,
  Badge,
  Button,
  Checkbox,
  Fieldset,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconCheck, IconLock, IconShieldCheck, IconTrash, IconUsers } from '@tabler/icons-react'
import { useState } from 'react'
import type { JSX } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { AccessError, describePermission, useAccessManagement } from 'domains/management/access'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { isDefined, isEmptyArray } from 'shared/value-predicates'
import { FormLeaveGuard } from 'ui/form-leave-guard'
import { PageHeading } from 'ui/page-heading'
import type { RoleEditorProps, RoleFormValues } from './types/role-editor-props.type'
import styles from './styles/role-editor.module.css'

/**
 * Редактирует права роли на самостоятельной странице управления доступом.
 *
 * Используется для:
 *  - создания и сохранения роли
 *  - удаления неназначенной дополнительной роли
 */
export const RoleEditor = ({ role, permissions, accounts }: RoleEditorProps): JSX.Element => {
  const access = useAccessManagement()
  const navigate = useNavigate()
  const [baseline, setBaseline] = useState(role)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDeleteOpened, setIsDeleteOpened] = useState(false)
  const [changes, setChanges] = useState({ added: 0, removed: 0 })
  const form = useForm<RoleFormValues>({
    mode: 'uncontrolled',
    validateInputOnBlur: true,
    initialValues: { key: role?.key ?? '', name: role?.name ?? '', permissions: role?.permissions ?? ['account.read'] },
    onValuesChange: (values) => {
      const previousPermissions = baseline?.permissions ?? ['account.read']
      setChanges({
        added: values.permissions.filter((key) => !previousPermissions.includes(key)).length,
        removed: previousPermissions.filter((key) => !values.permissions.includes(key)).length
      })
      setIsSaved(false)
    },
    validate: {
      name: (value) => (value.trim().length > 0 && value.length <= 120 ? null : 'Введите название до 120 символов'),
      key: (value) =>
        /^[A-Z][A-Z0-9_]{2,63}$/.test(value) ? null : 'От 3 до 64: заглавные латинские буквы, цифры и _',
      permissions: (values) => (values.includes('account.read') ? null : 'Для входа в панель требуется account.read')
    }
  })
  const isBuiltin = baseline?.isBuiltin === true
  const isExisting = isDefined(baseline)
  const isDisabled = isBuiltin || form.submitting || isDeleting
  const hasAssignments = !isEmptyArray(accounts)
  const shouldExplainSessions = hasAssignments && !isBuiltin
  const canDelete = isExisting && !isBuiltin && !hasAssignments
  const canEdit = !isBuiltin
  const shouldShowDelete = isExisting && !isBuiltin
  const inputVariant = isBuiltin ? 'filled' : 'default'
  const hasVersionConflict = isDefined(role) && isDefined(baseline) && role.version !== baseline.version
  const title = baseline?.name ?? 'Новая роль'
  const description = isBuiltin
    ? 'Встроенный набор прав. Его состав поддерживается системой.'
    : 'Настройте, какие действия будут доступны пользователям с этой ролью.'
  const submitLabel = isExisting ? 'Сохранить изменения' : 'Создать роль'
  const isSaveDisabled = isExisting && !form.isDirty()
  const isBusy = form.submitting || isDeleting
  const isSubmitDisabled = isSaveDisabled || hasVersionConflict || isDeleting
  const isDeleteDisabled = !canDelete || form.submitting
  const accountItems = accounts.slice(0, 5).map((account) => ({
    id: account.id,
    label: account.name || account.login,
    href: `/management/users/${encodeURIComponent(account.id)}`
  }))
  const permissionGroups = [
    {
      name: 'Личный аккаунт',
      description: 'Действия пользователя над собственной учётной записью.',
      items: permissions.filter((permission) => !permission.system)
    },
    {
      name: 'Администрирование',
      description: 'Системные возможности доступны только владельцу.',
      items: permissions.filter((permission) => permission.system)
    }
  ]
  /**
   * Отделяет ожидаемый отказ от дефекта приложения.
   */
  const handleError = (error: unknown): void => {
    if (error instanceof AccessError) {
      setErrorMessage(error.message)
      void access.mutate().catch(() => undefined)
      return
    }
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
      const savedRole = await access.saveRole(values, baseline?.version)
      const savedValues = { key: savedRole.key, name: savedRole.name, permissions: savedRole.permissions }
      form.setValues(savedValues)
      form.setInitialValues(savedValues)
      form.resetDirty(savedValues)
      setBaseline(savedRole)
      setChanges({ added: 0, removed: 0 })
      setIsSaved(true)
      if (!isExisting) void navigate(`/management/roles/${encodeURIComponent(savedRole.key)}`, { replace: true })
    } catch (error) {
      handleError(error)
    }
  }
  /**
   * Удаляет роль после явного пользовательского действия.
   */
  const handleDelete = async (): Promise<void> => {
    if (!isDefined(baseline) || !canDelete) return
    setIsDeleting(true)
    setErrorMessage(null)
    try {
      await access.deleteRole(baseline.key)
      form.resetDirty()
      void navigate('/management/roles')
    } catch (error) {
      handleError(error)
    } finally {
      setIsDeleting(false)
    }
  }
  /**
   * Заменяет черновик актуальной версией только по явному запросу пользователя.
   */
  const handleReload = (): void => {
    if (!isDefined(role)) return
    const freshValues = { key: role.key, name: role.name, permissions: role.permissions }
    form.setValues(freshValues)
    form.setInitialValues(freshValues)
    form.resetDirty(freshValues)
    setBaseline(role)
    setChanges({ added: 0, removed: 0 })
    setErrorMessage(null)
  }
  /**
   * Фокусирует первое некорректное поле.
   */
  const handleValidationError = (errors: typeof form.errors): void => {
    const first = Object.keys(errors)[0]
    if (first !== undefined) form.getInputNode(first)?.focus()
  }
  return (
    <>
      <FormLeaveGuard shouldBlock={form.isDirty} />
      <PageHeading eyebrow="Управление доступом / Роли" title={title} description={description} />
      <form noValidate onSubmit={form.onSubmit(handleSubmit, handleValidationError)}>
        <div className={styles.root}>
          <Stack gap="lg">
            {hasVersionConflict && (
              <Alert color="orange" title="Роль изменена другим пользователем">
                Ваш ввод сохранён на странице. Загрузите актуальные данные перед следующим сохранением.
                <Button variant="subtle" color="orange" mt="sm" onClick={handleReload}>
                  Загрузить актуальную версию и сбросить ввод
                </Button>
              </Alert>
            )}
            <Paper withBorder className={styles.panel}>
              <Title order={2} size="h3" mb="lg">
                О роли
              </Title>
              <Fieldset variant="unstyled" disabled={isBusy}>
                <Stack gap="lg">
                  <TextInput
                    label="Название роли"
                    placeholder="Например, Наблюдатель"
                    required={canEdit}
                    readOnly={isBuiltin}
                    variant={inputVariant}
                    key={form.key('name')}
                    {...form.getInputProps('name')}
                  />
                  <TextInput
                    label="Ключ роли"
                    description="Уникальное обозначение: латинские буквы, цифры и _. После создания не меняется."
                    placeholder="OBSERVER"
                    required={canEdit}
                    readOnly={isExisting}
                    variant={inputVariant}
                    key={form.key('key')}
                    {...form.getInputProps('key')}
                  />
                </Stack>
              </Fieldset>
            </Paper>
            <Paper withBorder className={styles.permissionPanel}>
              <Group justify="space-between" className={styles.permissionHeader}>
                <Title order={2} size="h3">
                  Права доступа
                </Title>
                <Anchor component={Link} to="/management/permissions" size="sm">
                  Каталог прав
                </Anchor>
              </Group>
              <Checkbox.Group key={form.key('permissions')} {...form.getInputProps('permissions')}>
                {permissionGroups.map((group) => (
                  <div key={group.name}>
                    <div className={styles.groupHeading}>
                      <Text fw={600}>{group.name}</Text>
                      <Text size="xs" c="dimmed" mt={4}>
                        {group.description}
                      </Text>
                    </div>
                    {group.items.map((permission) => {
                      const details = describePermission(permission.key, permission.name)
                      const isRequired = permission.key === 'account.read'
                      const isLocked = isDisabled || permission.system || isRequired
                      const hasLabel = isRequired || permission.system
                      const label = isRequired ? 'Обязательное' : 'Только владелец'
                      return (
                        <div className={styles.permission} key={permission.key}>
                          <Checkbox
                            value={permission.key}
                            label={details.name}
                            description={details.description}
                            disabled={isLocked}
                          />
                          <Group gap="sm" mt={8} pl={28}>
                            <Text className={styles.code}>{permission.key}</Text>
                            {hasLabel && (
                              <Badge size="xs" color="gray" leftSection={<IconLock size={10} />}>
                                {label}
                              </Badge>
                            )}
                          </Group>
                        </div>
                      )
                    })}
                  </div>
                ))}
              </Checkbox.Group>
            </Paper>
          </Stack>
          <Stack gap="lg" component="aside">
            <Paper withBorder className={styles.panel}>
              <ThemeIcon variant="light" size={42} radius="lg">
                <IconShieldCheck size={23} />
              </ThemeIcon>
              <Title order={2} size="h3" mt="md">
                Область действия
              </Title>
              <Text c="dimmed" size="sm" mt="sm" lh={1.7}>
                Пользователь получает возможности своей роли. Изменения применяются ко всем её участникам.
              </Text>
              <Group gap="xs" mt="xl">
                <IconUsers size={18} />
                <Text fw={600}>Пользователей: {accounts.length}</Text>
              </Group>
              <Stack gap="xs" mt="md">
                  {accountItems.map((account) => (
                  <Anchor
                    key={account.id}
                    component={Link}
                      to={account.href}
                    size="sm"
                  >
                      {account.label}
                  </Anchor>
                ))}
              </Stack>
              {shouldExplainSessions && (
                <Text size="xs" c="dimmed" mt="lg">
                  Сохранение роли завершит прежние сессии её пользователей.
                </Text>
              )}
            </Paper>
            {shouldShowDelete && (
              <Paper withBorder className={styles.panel}>
                <Text fw={600}>Удаление роли</Text>
                <Text size="sm" c="dimmed" mt="xs" mb="md">
                  Удалить можно только роль, которая не назначена пользователям.
                </Text>
                <Button
                  variant="light"
                  color="red"
                  leftSection={<IconTrash size={16} />}
                  disabled={isDeleteDisabled}
                  onClick={() => setIsDeleteOpened(true)}
                >
                  Удалить роль
                </Button>
              </Paper>
            )}
          </Stack>
        </div>
        {isDefined(errorMessage) && (
          <Alert color="red" role="alert" mt="lg">
            {errorMessage}
          </Alert>
        )}
        {isSaved && (
          <Alert color="teal" icon={<IconCheck size={18} />} role="status" mt="lg">
            Роль сохранена.
          </Alert>
        )}
        {canEdit && (
          <Paper withBorder className={styles.saveBar}>
            <div>
              <Text size="sm" fw={600}>
                Изменения роли
              </Text>
              <Text size="xs" c="dimmed">
                Прав добавлено: {changes.added} · снято: {changes.removed}
              </Text>
            </div>
            <Group gap="sm">
              <Button component={Link} to="/management/roles" variant="default" disabled={form.submitting}>
                Отмена
              </Button>
              <Button
                type="submit"
                disabled={isSubmitDisabled}
                loading={form.submitting}
              >
                {submitLabel}
              </Button>
            </Group>
          </Paper>
        )}
      </form>
      <Modal
        opened={isDeleteOpened}
        onClose={() => setIsDeleteOpened(false)}
        title="Удалить роль?"
        withCloseButton={!isDeleting}
        closeOnEscape={!isDeleting}
        closeOnClickOutside={!isDeleting}
      >
        <Stack>
          <Text>Роль «{title}» будет удалена. Это действие нельзя отменить.</Text>
          {isDefined(errorMessage) && (
            <Alert color="red" role="alert">
              {errorMessage}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" disabled={isDeleting} onClick={() => setIsDeleteOpened(false)}>
              Отмена
            </Button>
            <Button color="red" loading={isDeleting} onClick={handleDelete}>
              Удалить роль
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
