import {
  Alert,
  Anchor,
  Badge,
  Button,
  Fieldset,
  Group,
  Paper,
  PasswordInput,
  Select,
  Stack,
  Switch,
  Text,
  TextInput,
  ThemeIcon,
  Title
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconCheck, IconInfoCircle, IconShieldCheck, IconUser } from '@tabler/icons-react'
import { useState } from 'react'
import type { JSX } from 'react'
import { Link } from 'react-router-dom'
import { AccessError, useAccessManagement } from 'domains/admin-access'
import { logout, useGetCurrentUser, usePermission } from 'domains/auth'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { isDefined } from 'shared/value-predicates'
import { FormLeaveGuard } from 'ui/form-leave-guard'
import type { AccountEditorProps, AccountFormValues } from './types/account-editor-props.type'
import styles from './styles/account-editor.module.css'

/**
 * Создаёт аккаунт либо редактирует его профиль и доступ по ожидаемой версии.
 *
 * Используется для:
 *  - выдачи первоначального доступа
 *  - смены роли и активности существующего аккаунта
 */
export const AccountEditor = (props: AccountEditorProps): JSX.Element => {
  const { account, roles, isLastOwner, returnTo, onCreated } = props
  const access = useAccessManagement()
  const currentUser = useGetCurrentUser()
  const canManage = usePermission('system.access.manage')
  const canActivate = usePermission('accounts.activate')
  const canChange = canManage || canActivate
  const [baseline, setBaseline] = useState(account)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const isExisting = isDefined(baseline)
  const isCreating = !isExisting
  const isSelf = isDefined(baseline) && baseline.id === currentUser.data?.id
  const form = useForm<AccountFormValues>({
    mode: 'uncontrolled',
    validateInputOnBlur: true,
    initialValues: {
      login: account?.login ?? '',
      name: account?.name ?? '',
      password: '',
      confirmation: '',
      role: account?.role ?? 'USER',
      isActive: account?.isActive ?? true
    },
    onValuesChange: () => setIsSaved(false),
    validate: {
      name: (value) => (value.length <= 120 ? null : 'Не больше 120 символов'),
      login: (value) => (/^[a-zA-Z0-9_.-]{3,64}$/.test(value) ? null : 'От 3 до 64 латинских букв, цифр, _, . или -'),
      password: (value) =>
        isExisting || (Array.from(value).length >= 12 && Array.from(value).length <= 128)
          ? null
          : 'От 12 до 128 символов',
      confirmation: (value, values) => (isExisting || value === values.password ? null : 'Пароли не совпадают'),
      role: (value) => (value !== '' ? null : 'Выберите роль')
    }
  })
  const roleItems = canManage
    ? roles.map((role) => ({ value: role.key, label: `${role.name} (${role.key})` }))
    : [{ value: account?.role ?? 'USER', label: account?.role ?? 'USER' }]
  const hasVersionConflict = isDefined(account) && isDefined(baseline) && account.version !== baseline.version
  const isSaveDisabled = !canChange || form.submitting || hasVersionConflict || (isExisting && !form.isDirty())
  const isLoginSwitchDisabled = isLastOwner || (!canManage && (!canActivate || baseline?.isActive === true))
  const submitLabel = canManage
    ? (isExisting ? 'Сохранить изменения' : 'Создать пользователя')
    : 'Разрешить вход'
  const saveDescription = isExisting
    ? 'После сохранения пользователю понадобится войти снова.'
    : 'Аккаунт станет доступен сразу после создания.'

  /**
   * Сохраняет доступ; после изменения собственной роли завершает локальную сессию.
   */
  const handleSubmit = async (values: AccountFormValues): Promise<void> => {
    setErrorMessage(null)
    setIsSaved(false)
    try {
      if (!isDefined(baseline)) {
        const createdAccount = await access.createAccount({
          login: values.login,
          name: values.name,
          password: values.password,
          role: values.role
        })
        form.resetDirty()
        onCreated(createdAccount)
        return
      }
      const savedAccount = canManage
        ? await access.updateAccount({
            id: baseline.id,
            version: baseline.version,
            login: values.login,
            name: values.name,
            role: values.role,
            isActive: values.isActive
          })
        : await access.activateAccount({ id: baseline.id, version: baseline.version })
      const savedValues = {
        name: savedAccount.name,
        login: savedAccount.login,
        role: savedAccount.role,
        isActive: savedAccount.isActive,
        password: '',
        confirmation: ''
      }
      form.setValues(savedValues)
      form.setInitialValues(savedValues)
      form.resetDirty(savedValues)
      setBaseline(savedAccount)
      setIsSaved(true)
      if (isSelf) await logout()
    } catch (error) {
      if (error instanceof AccessError) {
        setErrorMessage(error.message)
        void access.mutate().catch(() => undefined)
        return
      }
      reportApplicationDefect(toApplicationDefect('accounts.edit', error))
      setErrorMessage('Не удалось подтвердить результат. Обновите список перед повтором.')
    }
  }

  /**
   * Заменяет черновик актуальной версией только по явному выбору пользователя.
   */
  const handleReload = (): void => {
    if (!isDefined(account)) return
    const freshValues = {
      name: account.name,
      login: account.login,
      role: account.role,
      isActive: account.isActive,
      password: '',
      confirmation: ''
    }
    form.setValues(freshValues)
    form.setInitialValues(freshValues)
    form.resetDirty(freshValues)
    setBaseline(account)
    setErrorMessage(null)
    setIsSaved(false)
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
      <form noValidate onSubmit={form.onSubmit(handleSubmit, handleValidationError)}>
        {hasVersionConflict && (
          <Alert color="orange" title="Данные пользователя изменились" mb="lg">
            Черновик сохранён на странице. Загрузите актуальную версию, чтобы избежать перезаписи чужих изменений.
            <Button variant="subtle" color="orange" mt="sm" onClick={handleReload}>
              Загрузить актуальные данные и сбросить ввод
            </Button>
          </Alert>
        )}
        <Fieldset variant="unstyled" miw={0} disabled={form.submitting}>
          <div className={styles.root}>
            <Stack gap="lg">
              <Paper withBorder className={styles.panel}>
                <Group gap="sm" mb="xl">
                  <ThemeIcon variant="light" radius="lg" size={36}>
                    <IconUser size={20} />
                  </ThemeIcon>
                  <div>
                    <Title order={2} size="h3">
                      Данные пользователя
                    </Title>
                    <Text size="sm" c="dimmed" mt={4}>
                      Имя в панели и логин для входа.
                    </Text>
                  </div>
                </Group>
                <Stack gap="lg">
                  <TextInput
                    label="Имя"
                    readOnly={!canManage}
                    placeholder="Имя и фамилия"
                    autoComplete="off"
                    key={form.key('name')}
                    {...form.getInputProps('name')}
                  />
                  <TextInput
                    label="Логин"
                    readOnly={!canManage}
                    description="Латинские буквы, цифры, точка, дефис или подчёркивание. Регистр не учитывается."
                    placeholder="ivan.petrov"
                    required
                    autoComplete="off"
                    key={form.key('login')}
                    {...form.getInputProps('login')}
                  />
                  {isDefined(baseline) && (
                    <div className={styles.identifier}>
                      <Text size="xs" c="dimmed">
                        ID пользователя
                      </Text>
                      <Text className={styles.code}>{baseline.id}</Text>
                    </div>
                  )}
                </Stack>
              </Paper>
              {isCreating && (
                <Paper withBorder className={styles.panel}>
                  <Title order={2} size="h3" mb="sm">
                    Первоначальный пароль
                  </Title>
                  <Text size="sm" c="dimmed" mb="lg">
                    Передайте его пользователю для первого входа. Сохранённые пароли не отображаются в панели.
                  </Text>
                  <Stack gap="lg">
                    <PasswordInput
                      label="Пароль"
                      description="От 12 до 128 символов"
                      required
                      autoComplete="new-password"
                      key={form.key('password')}
                      {...form.getInputProps('password')}
                    />
                    <PasswordInput
                      label="Повторите пароль"
                      required
                      autoComplete="new-password"
                      key={form.key('confirmation')}
                      {...form.getInputProps('confirmation')}
                    />
                  </Stack>
                </Paper>
              )}
              {isSelf && (
                <Alert icon={<IconInfoCircle size={18} />} color="blue">
                  Это ваш аккаунт. Изменение здесь завершит вашу сессию.
                  <Anchor component={Link} to="/profile" size="sm" ml={4}>
                    Открыть личный профиль
                  </Anchor>
                </Alert>
              )}
            </Stack>
            <Paper withBorder className={styles.panel}>
              <Group gap="sm" mb="xl">
                <ThemeIcon variant="light" radius="lg" size={36}>
                  <IconShieldCheck size={20} />
                </ThemeIcon>
                <Title order={2} size="h3">
                  Доступ к панели
                </Title>
              </Group>
              <Stack gap="lg">
                <Select
                  label="Роль пользователя"
                  description="Роль определяет доступные разделы и действия."
                  required
                  searchable
                  allowDeselect={false}
                  readOnly={isLastOwner || !canManage}
                  data={roleItems}
                  key={form.key('role')}
                  {...form.getInputProps('role')}
                />
                {canManage && (
                  <Anchor component={Link} to="/management/roles" size="sm">
                    Посмотреть возможности ролей
                  </Anchor>
                )}
                {isExisting && (
                  <Switch
                    label="Разрешить вход"
                    description="Без разрешения пользователь не сможет войти. После включения попросите его войти заново."
                    disabled={isLoginSwitchDisabled}
                    key={form.key('isActive')}
                    {...form.getInputProps('isActive', { type: 'checkbox' })}
                  />
                )}
                {isCreating && (
                  <Badge color="teal" variant="dot">
                    Вход будет разрешён
                  </Badge>
                )}
                {isLastOwner && (
                  <Text size="sm" c="dimmed" lh={1.6}>
                    Это последний активный владелец. Для изменения его роли или отключения сначала назначьте другого
                    владельца.
                  </Text>
                )}
              </Stack>
            </Paper>
          </div>
          {isDefined(errorMessage) && (
            <Alert color="red" role="alert" mt="lg">
              {errorMessage}
            </Alert>
          )}
          {isSaved && (
            <Alert color="teal" role="status" icon={<IconCheck size={18} />} mt="lg">
              Изменения пользователя сохранены. Прежние сессии завершены.
            </Alert>
          )}
          <Paper withBorder className={styles.saveBar}>
            <Text size="sm" c="dimmed" maw={380}>
              {saveDescription}
            </Text>
            <Group gap="sm">
              <Button component={Link} to={returnTo} variant="default" disabled={form.submitting}>
                Отмена
              </Button>
              {canChange && (
                <Button type="submit" loading={form.submitting} disabled={isSaveDisabled}>
                  {submitLabel}
                </Button>
              )}
            </Group>
          </Paper>
        </Fieldset>
      </form>
    </>
  )
}
