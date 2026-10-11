import {
  Accordion,
  Alert,
  Badge,
  Button,
  Fieldset,
  Group,
  Paper,
  Stack,
  Tabs,
  Text,
  TextInput,
  ThemeIcon,
  Title
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconCheck, IconLock, IconShieldCheck, IconUser, IconKey, IconArrowRight } from '@tabler/icons-react'
import { useState } from 'react'
import type { JSX } from 'react'
import { useSearchParams } from 'react-router-dom'
import { isAuthError, useAccountSettings } from 'domains/auth'
import { describePermission } from 'domains/admin-access'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { isDefined } from 'shared/value-predicates'
import { FormLeaveGuard } from 'ui/form-leave-guard'
import type { ProfileSettingsProps, ProfileSettingsValues } from './types/profile-settings-props.type'
import { CredentialsDialog } from '../credentials-dialog/credentials-dialog'
import { formatProfileTimestamp } from '../../helpers/format-profile-timestamp'
import styles from './styles/profile-settings.module.css'

/**
 * Предоставляет действия над собственным профилем и credentials.
 *
 * Используется для:
 *  - изменения имени
 *  - смены логина и пароля с завершением прежних сессий
 */
export const ProfileSettings = ({ profile }: ProfileSettingsProps): JSX.Element => {
  const settings = useAccountSettings()
  const [searchParams, setSearchParams] = useSearchParams()
  const [action, setAction] = useState<'login' | 'password' | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [isSaved, setIsSaved] = useState(false)
  const canChangeName = profile.permissions.includes('account.update')
  const canChangeLogin = profile.permissions.includes('account.login.change')
  const canChangePassword = profile.hasLocalPassword && profile.permissions.includes('account.password.change')
  const activeTab = searchParams.get('tab') === 'security' ? 'security' : 'general'
  const passwordTitle = profile.hasLocalPassword ? 'Локальный пароль' : 'Корпоративная учётная запись'
  const passwordDescription = profile.hasLocalPassword
    ? 'Используйте уникальный пароль, который вы не используете в других сервисах.'
    : 'Пароль управляется в корпоративной системе. Для его изменения обратитесь к настройкам вашей учётной записи в Keycloak.'
  const passwordStatus = profile.hasLocalPassword ? 'Настроен' : 'Вход через SSO'
  const permissionItems = profile.permissions.map((key) => ({ key, ...describePermission(key) }))
  const createdAtLabel = formatProfileTimestamp(profile.createdAt)
  const updatedAtLabel = formatProfileTimestamp(profile.updatedAt)
  const savedMessage = isSaved ? 'Изменения сохранены' : ''
  const form = useForm<ProfileSettingsValues>({
    mode: 'uncontrolled',
    validateInputOnBlur: true,
    initialValues: { name: profile.name },
    onValuesChange: () => setIsSaved(false),
    validate: {
      name: (value) => (value.length <= 120 ? null : 'Не больше 120 символов')
    }
  })
  /**
   * Выполняет выбранное действие через доменный lifecycle.
   */
  const handleSubmit = async (values: ProfileSettingsValues): Promise<void> => {
    setErrorMessage(null)
    setIsSaved(false)
    try {
      await settings.updateName(values.name)
      form.resetDirty(values)
      setIsSaved(true)
    } catch (error) {
      if (isAuthError(error)) {
        setErrorMessage('Не удалось сохранить имя. Проверьте состояние сессии и попробуйте ещё раз.')
        return
      }
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
  /**
   * Сохраняет выбранную вкладку в адресе страницы.
   */
  const handleTabChange = (tab: string | null): void => {
    setSearchParams(tab === 'security' ? { tab } : {})
  }
  return (
    <>
      <FormLeaveGuard shouldBlock={form.isDirty} />
      <Tabs value={activeTab} onChange={handleTabChange}>
        <Tabs.List mb="xl">
          <Tabs.Tab value="general" leftSection={<IconUser size={17} />}>
            Основное
          </Tabs.Tab>
          <Tabs.Tab value="security" leftSection={<IconLock size={17} />}>
            Безопасность
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="general">
          <div className={styles.grid}>
            <Stack gap="lg">
              <Paper withBorder className={styles.panel}>
                <Title order={2} size="h3">
                  Личные данные
                </Title>
                <Text size="sm" c="dimmed" mt={6} mb="xl">
                  Так вас будут видеть в рабочем пространстве.
                </Text>
                <form noValidate onSubmit={form.onSubmit(handleSubmit, handleValidationError)}>
                  <Fieldset variant="unstyled" disabled={form.submitting}>
                    <Stack gap="lg">
                      <TextInput
                        label="Имя"
                        autoComplete="name"
                        readOnly={!canChangeName}
                        key={form.key('name')}
                        {...form.getInputProps('name')}
                      />
                      <Group justify="space-between" align="center" className={styles.loginRow}>
                        <div>
                          <Text size="sm" fw={600}>
                            Логин
                          </Text>
                          <Text c="dimmed" className={styles.value}>
                            {profile.login}
                          </Text>
                        </div>
                        {canChangeLogin && (
                          <Button variant="subtle" size="xs" onClick={() => setAction('login')}>
                            Изменить логин
                          </Button>
                        )}
                      </Group>
                      {isDefined(errorMessage) && (
                        <Alert color="red" role="alert">
                          {errorMessage}
                        </Alert>
                      )}
                      <Group justify="space-between" className={styles.actions}>
                        <Text size="sm" c="teal" role="status">
                          {savedMessage}
                        </Text>
                        {canChangeName && (
                          <Button type="submit" loading={form.submitting} disabled={!form.isDirty()}>
                            Сохранить изменения
                          </Button>
                        )}
                      </Group>
                    </Stack>
                  </Fieldset>
                </form>
              </Paper>
              <Accordion variant="contained" radius="lg">
                <Accordion.Item value="details">
                  <Accordion.Control>
                    <Text size="sm" fw={500}>
                      Сведения об аккаунте
                    </Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <dl className={styles.details}>
                      <dt>Идентификатор</dt>
                      <dd className={styles.detailValue}>{profile.id}</dd>
                      <dt>Создан</dt>
                      <dd className={styles.detailValue}>{createdAtLabel}</dd>
                      <dt>Обновлён</dt>
                      <dd className={styles.detailValue}>{updatedAtLabel}</dd>
                    </dl>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Stack>
            <Paper withBorder className={styles.panel} component="aside">
              <ThemeIcon variant="light" size={42} radius="lg">
                <IconShieldCheck size={23} />
              </ThemeIcon>
              <Title order={2} size="h3" mt="md">
                Ваш доступ
              </Title>
              <Text fw={600} mt="lg">
                {profile.roleName}
              </Text>
              <Text size="sm" c="dimmed" mt={6} lh={1.6}>
                Возможности аккаунта определяются назначенной ролью.
              </Text>
              <Accordion variant="default" mt="lg">
                <Accordion.Item value="permissions">
                  <Accordion.Control px={0}>
                    <Text size="sm">Доступные действия · {permissionItems.length}</Text>
                  </Accordion.Control>
                  <Accordion.Panel>
                    <Stack gap="sm">
                      {permissionItems.map((permission) => (
                        <Group key={permission.key} gap="xs" wrap="nowrap" align="flex-start">
                          <IconCheck size={16} className={styles.checkIcon} />
                          <Text size="sm">{permission.name}</Text>
                        </Group>
                      ))}
                    </Stack>
                  </Accordion.Panel>
                </Accordion.Item>
              </Accordion>
            </Paper>
          </div>
        </Tabs.Panel>
        <Tabs.Panel value="security">
          <Paper withBorder className={styles.panel}>
            <Group justify="space-between" mb="lg">
              <Group>
                <ThemeIcon variant="light" size={42} radius="lg">
                  <IconKey size={23} />
                </ThemeIcon>
                <Title order={2} size="h3">
                  {passwordTitle}
                </Title>
              </Group>
              <Badge color="teal">{passwordStatus}</Badge>
            </Group>
            <Text c="dimmed" maw={620} lh={1.7}>
              {passwordDescription}
            </Text>
            {canChangePassword && (
              <Button
                mt="xl"
                variant="default"
                rightSection={<IconArrowRight size={16} />}
                onClick={() => setAction('password')}
              >
                Изменить пароль
              </Button>
            )}
          </Paper>
          <Text mt="lg" size="sm" c="dimmed">
            После смены логина или пароля все ваши сессии завершатся. Потребуется новый вход.
          </Text>
        </Tabs.Panel>
      </Tabs>
      {isDefined(action) && (
        <CredentialsDialog
          action={action}
          login={profile.login}
          hasLocalPassword={profile.hasLocalPassword}
          onClose={() => setAction(null)}
        />
      )}
    </>
  )
}
