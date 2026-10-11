import {
  Accordion,
  Alert,
  Badge,
  Button,
  Checkbox,
  Fieldset,
  Group,
  List,
  Modal,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { useClipboard } from '@mantine/hooks'
import {
  IconArrowRight,
  IconCheck,
  IconCopy,
  IconKey,
  IconLock,
  IconPlugConnected,
  IconShieldCheck
} from '@tabler/icons-react'
import { useState } from 'react'
import type { JSX } from 'react'
import { Link } from 'react-router-dom'
import { KeycloakSettingsError, useKeycloakSettings } from 'domains/management/keycloak-settings'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { isDefined } from 'shared/value-predicates'
import { FormLeaveGuard } from 'ui/form-leave-guard'
import type { KeycloakFormProps, KeycloakFormValues } from './types/keycloak-form-props.type'
import styles from './styles/keycloak-form.module.css'

/**
 * Редактирует конфигурацию OIDC и передаёт secret только при явной замене.
 *
 * Используется для:
 *  - сохранения черновика и включения провайдера
 *  - замены или удаления сохранённого секрета
 */
export const KeycloakForm = ({ settings }: KeycloakFormProps): JSX.Element => {
  const configuration = useKeycloakSettings()
  const clipboard = useClipboard({ timeout: 2000 })
  const [baseline, setBaseline] = useState(settings)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [isSecretEditing, setIsSecretEditing] = useState(!settings.hasSecret)
  const [isDisableOpened, setIsDisableOpened] = useState(false)
  const [isActivating, setIsActivating] = useState(false)
  const [advancedSection, setAdvancedSection] = useState<string | null>(null)
  const form = useForm<KeycloakFormValues>({
    mode: 'uncontrolled',
    validateInputOnBlur: true,
    onValuesChange: () => setSuccessMessage(null),
    initialValues: {
      enabled: settings.enabled,
      issuer: settings.issuer,
      clientId: settings.clientId,
      clientSecret: '',
      clearSecret: false,
      callbackUrl: settings.callbackUrl || new URL('/api/auth/callback', window.location.origin).href,
      frontendCallbackUrl:
        settings.frontendCallbackUrl || new URL('/auth/keycloak/callback', window.location.origin).href
    },
    validate: {
      issuer: (value, values) => (values.enabled && value.trim() === '' ? 'Введите issuer realm' : null),
      clientId: (value, values) => (values.enabled && value.trim() === '' ? 'Введите Client ID' : null),
      clientSecret: (value, values) => {
        if (values.enabled && ((!baseline.hasSecret && value === '') || values.clearSecret))
          return 'Для включения требуется Client Secret'
        const hasChangedClient = values.issuer !== baseline.issuer || values.clientId !== baseline.clientId
        if (baseline.hasSecret && hasChangedClient && value === '' && !values.clearSecret)
          return 'Для нового сервера или Client ID введите новый секрет'
        if (values.clearSecret && value !== '') return 'Выберите замену или удаление секрета'
        return null
      },
      callbackUrl: (value, values) => (values.enabled && value.trim() === '' ? 'Введите backend callback URL' : null),
      frontendCallbackUrl: (value, values) =>
        values.enabled && value.trim() === '' ? 'Введите frontend callback URL' : null
    }
  })
  const hasVersionConflict = settings.version !== baseline.version
  const canActivate = !baseline.enabled
  const canClearSecret = !baseline.enabled && baseline.hasSecret
  const hasSavedSecret = baseline.hasSecret && !isSecretEditing
  const statusLabel = baseline.enabled ? 'Вход включён' : baseline.hasSecret ? 'Вход выключен' : 'Не настроен'
  const statusColor = baseline.enabled ? 'teal' : 'gray'
  const saveLabel = baseline.enabled ? 'Сохранить изменения' : 'Сохранить настройки'
  const copyLabel = clipboard.copied ? 'Адрес скопирован' : 'Скопировать Redirect URI'
  const isSaveDisabled = form.submitting || hasVersionConflict
  const isCheckingConfiguration = form.submitting && isActivating
  const isSavingSettings = form.submitting && !isActivating
  /**
   * Отправляет текущую версию и очищает секрет после подтверждённой записи.
   */
  const handleSubmit = async (values: KeycloakFormValues): Promise<void> => {
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      const savedSettings = await configuration.save({
        enabled: values.enabled,
        issuer: values.issuer,
        clientId: values.clientId,
        callbackUrl: values.callbackUrl,
        frontendCallbackUrl: values.frontendCallbackUrl,
        clientSecret: values.clientSecret || undefined,
        clearSecret: values.clearSecret,
        version: baseline.version
      })
      const savedValues = {
        enabled: savedSettings.enabled,
        issuer: savedSettings.issuer,
        clientId: savedSettings.clientId,
        callbackUrl: savedSettings.callbackUrl,
        frontendCallbackUrl: savedSettings.frontendCallbackUrl,
        clientSecret: '',
        clearSecret: false
      }
      form.setValues(savedValues)
      form.setInitialValues(savedValues)
      form.resetDirty(savedValues)
      setBaseline(savedSettings)
      setIsSecretEditing(!savedSettings.hasSecret)
      setIsDisableOpened(false)
      setSuccessMessage(
        savedSettings.enabled
          ? 'Keycloak подключён. Новые аккаунты получают роль USER; вход в панель разрешает администратор.'
          : 'Настройки сохранены. Вход через Keycloak выключен.'
      )
    } catch (error) {
      form.setFieldValue('enabled', baseline.enabled)
      if (error instanceof KeycloakSettingsError) {
        setErrorMessage(error.message)
        void configuration.mutate().catch(() => undefined)
        return
      }
      reportApplicationDefect(toApplicationDefect('keycloak-settings.form', error))
      setErrorMessage('Не удалось подтвердить сохранение. Обновите страницу перед повтором.')
    } finally {
      setIsActivating(false)
    }
  }
  /**
   * Фокусирует первое некорректное поле.
   */
  const handleValidationError = (errors: typeof form.errors): void => {
    setIsActivating(false)
    setIsSecretEditing(true)
    setIsDisableOpened(false)
    if (isDefined(errors.frontendCallbackUrl)) setAdvancedSection('advanced')
    form.setFieldValue('enabled', baseline.enabled)
    const first = Object.keys(errors)[0]
    if (isDefined(first)) {
      requestAnimationFrame(() => form.getInputNode(first)?.focus())
    }
  }
  /**
   * Заменяет локальный черновик свежей серверной версией по явному действию.
   */
  const handleReload = (): void => {
    const freshValues = {
      enabled: settings.enabled,
      issuer: settings.issuer,
      clientId: settings.clientId,
      callbackUrl: settings.callbackUrl,
      frontendCallbackUrl: settings.frontendCallbackUrl,
      clientSecret: '',
      clearSecret: false
    }
    form.setValues(freshValues)
    form.setInitialValues(freshValues)
    form.resetDirty(freshValues)
    setBaseline(settings)
    setIsSecretEditing(!settings.hasSecret)
    setErrorMessage(null)
  }
  return (
    <>
      <FormLeaveGuard shouldBlock={form.isDirty} />
      <Paper withBorder className={styles.provider}>
        <Group gap="lg" wrap="nowrap">
          <ThemeIcon size={56} radius={16} variant="light">
            <IconKey size={29} stroke={1.5} />
          </ThemeIcon>
          <div>
            <Title order={2} size="h2">
              Keycloak
            </Title>
            <Text c="dimmed" size="sm" mt={4}>
              Корпоративный провайдер · OpenID Connect
            </Text>
          </div>
        </Group>
        <Badge variant="dot" color={statusColor} size="lg">
          {statusLabel}
        </Badge>
      </Paper>
      <form noValidate onSubmit={form.onSubmit(handleSubmit, handleValidationError)}>
        <div className={styles.root}>
          <Stack gap="lg">
            {hasVersionConflict && (
              <Alert color="orange" title="Настройки изменены другим пользователем">
                Ваш ввод сохранён на странице. Для продолжения загрузите актуальную версию.
                <Button variant="subtle" color="orange" mt="sm" onClick={handleReload}>
                  Загрузить актуальные настройки и сбросить ввод
                </Button>
              </Alert>
            )}
            <Paper withBorder className={styles.panel}>
              <Group gap="sm" mb="lg">
                <ThemeIcon variant="light" color="gray" radius="xl" size={28}>
                  1
                </ThemeIcon>
                <Title order={2} size="h3">
                  Подключение
                </Title>
              </Group>
              <Fieldset variant="unstyled" disabled={form.submitting}>
                <Stack gap="lg">
                  <TextInput
                    label="Issuer URL"
                    description="Адрес realm вашей организации в Keycloak."
                    placeholder="https://sso.company.ru/realms/company"
                    key={form.key('issuer')}
                    {...form.getInputProps('issuer')}
                  />
                  <TextInput
                    label="Client ID"
                    description="Идентификатор клиента с включённой аутентификацией."
                    placeholder="admin-panel"
                    key={form.key('clientId')}
                    {...form.getInputProps('clientId')}
                  />
                  {hasSavedSecret && (
                    <Group justify="space-between" className={styles.secret}>
                      <Group gap="xs">
                        <IconLock size={18} />
                        <div>
                          <Text size="sm" fw={600}>
                            Client Secret сохранён
                          </Text>
                          <Text size="xs" c="dimmed">
                            Значение доступно только серверу
                          </Text>
                        </div>
                      </Group>
                      <Button size="xs" variant="default" onClick={() => setIsSecretEditing(true)}>
                        Заменить
                      </Button>
                    </Group>
                  )}
                  {isSecretEditing && (
                    <PasswordInput
                      label="Client Secret"
                      description="Скопируйте значение из вкладки Credentials вашего клиента."
                      autoComplete="new-password"
                      disabled={!settings.canStoreSecret}
                      key={form.key('clientSecret')}
                      {...form.getInputProps('clientSecret')}
                    />
                  )}
                  {!settings.canStoreSecret && (
                    <Alert color="orange">
                      Сервер пока не поддерживает сохранение секрета. Обратитесь к администратору сервиса.
                    </Alert>
                  )}
                  <Text size="xs" c="dimmed">
                    При смене Issuer URL или Client ID необходимо указать новый Client Secret.
                  </Text>
                </Stack>
              </Fieldset>
            </Paper>
            <Paper withBorder className={styles.panel}>
              <Group gap="sm" mb="lg">
                <ThemeIcon variant="light" color="gray" radius="xl" size={28}>
                  2
                </ThemeIcon>
                <Title order={2} size="h3">
                  Адреса возврата
                </Title>
              </Group>
              <Fieldset variant="unstyled" disabled={form.submitting}>
                <Stack gap="lg">
                  <TextInput
                    label="Redirect URI"
                    description="Добавьте этот адрес в Valid redirect URIs клиента Keycloak."
                    key={form.key('callbackUrl')}
                    {...form.getInputProps('callbackUrl')}
                  />
                  <Group>
                    <Button
                      size="xs"
                      variant="light"
                      leftSection={<IconCopy size={15} />}
                      onClick={() => clipboard.copy(form.getValues().callbackUrl)}
                    >
                      {copyLabel}
                    </Button>
                  </Group>
                  <Accordion variant="default" value={advancedSection} onChange={setAdvancedSection}>
                    <Accordion.Item value="advanced">
                      <Accordion.Control px={0}>
                        <Text size="sm">Дополнительные настройки</Text>
                      </Accordion.Control>
                      <Accordion.Panel>
                        <Stack gap="lg">
                          <TextInput
                            label="Адрес завершения входа в панели"
                            description="Frontend callback URL. Этот адрес не нужно добавлять в Keycloak."
                            key={form.key('frontendCallbackUrl')}
                            {...form.getInputProps('frontendCallbackUrl')}
                          />
                          {canClearSecret && (
                            <Checkbox
                              label="Удалить сохранённый Client Secret при сохранении"
                              description="Для повторного включения потребуется ввести его заново."
                              key={form.key('clearSecret')}
                              {...form.getInputProps('clearSecret', { type: 'checkbox' })}
                            />
                          )}
                        </Stack>
                      </Accordion.Panel>
                    </Accordion.Item>
                  </Accordion>
                </Stack>
              </Fieldset>
            </Paper>
            <Paper withBorder className={styles.panel}>
              <Group gap="sm" mb="lg">
                <ThemeIcon variant="light" color="gray" radius="xl" size={28}>
                  3
                </ThemeIcon>
                <Title order={2} size="h3">
                  Применение настроек
                </Title>
              </Group>
              <Text size="sm" c="dimmed" lh={1.7}>
                При включении проверяется конфигурация провайдера. Успешность входа конкретного пользователя зависит
                также от состояния его учётной записи. Новый аккаунт получает роль USER с запрещённым входом в панель.
              </Text>
              <Text size="sm" mt="md" lh={1.7}>
                Сохранение настроек завершит прежние SSO-сессии, включая вашу, если вы вошли через Keycloak. Локальный
                вход останется доступен.
              </Text>
              {isDefined(errorMessage) && (
                <Alert color="red" role="alert" mt="lg">
                  {errorMessage}
                </Alert>
              )}
              {isDefined(successMessage) && (
                <Alert color="teal" icon={<IconCheck size={18} />} role="status" mt="lg">
                  {successMessage}
                </Alert>
              )}
              <Group mt="xl" gap="sm">
                <Button
                  type="submit"
                  variant="default"
                  disabled={isSaveDisabled}
                  loading={isSavingSettings}
                  onClick={() => {
                    form.setFieldValue('enabled', baseline.enabled)
                    setIsActivating(false)
                  }}
                >
                  {saveLabel}
                </Button>
                {canActivate && (
                  <Button
                    type="submit"
                    leftSection={<IconPlugConnected size={17} />}
                    disabled={isSaveDisabled}
                    loading={isCheckingConfiguration}
                    onClick={() => {
                      form.setFieldValue('enabled', true)
                      setIsActivating(true)
                    }}
                  >
                    Проверить и включить
                  </Button>
                )}
                {baseline.enabled && (
                  <Button
                    color="red"
                    variant="subtle"
                    disabled={isSaveDisabled}
                    onClick={() => setIsDisableOpened(true)}
                  >
                    Отключить вход
                  </Button>
                )}
              </Group>
              {isCheckingConfiguration && (
                <Text size="sm" c="dimmed" mt="sm" role="status">
                  Проверяем конфигурацию провайдера…
                </Text>
              )}
            </Paper>
          </Stack>
          <Stack gap="lg" component="aside">
            <Paper withBorder className={styles.panel}>
              <ThemeIcon variant="light" size={42} radius="lg">
                <IconShieldCheck size={23} />
              </ThemeIcon>
              <Title order={2} size="h3" mt="md" mb="lg">
                Перед подключением
              </Title>
              <List type="ordered" spacing="lg" size="sm" className={styles.instructions}>
                <List.Item>В своём realm создайте клиент OpenID Connect.</List.Item>
                <List.Item>Включите Client authentication и Standard flow.</List.Item>
                <List.Item>Добавьте Redirect URI из формы в Valid redirect URIs.</List.Item>
                <List.Item>Скопируйте Client ID и Client Secret в настройки подключения.</List.Item>
              </List>
            </Paper>
            <Paper withBorder className={styles.panel}>
              <Title order={2} size="h3">
                Доступ сотрудников
              </Title>
              <Text size="sm" c="dimmed" mt="sm" lh={1.7}>
                При первом входе создаётся аккаунт USER. Откройте его карточку и включите «Разрешить вход»,
                чтобы предоставить доступ к панели. Существующий аккаунт можно привязать к Keycloak вручную.
              </Text>
              <Button
                component={Link}
                to="/management/users"
                variant="light"
                mt="lg"
                rightSection={<IconArrowRight size={16} />}
              >
                К пользователям
              </Button>
            </Paper>
            <Text size="xs" c="dimmed" px="sm" lh={1.7}>
              Срок сессии панели — 7 дней. Выход из панели завершает только её сессию, а не глобальную сессию Keycloak.
            </Text>
          </Stack>
        </div>
      </form>
      <Modal
        opened={isDisableOpened}
        onClose={() => setIsDisableOpened(false)}
        title="Отключить корпоративный вход?"
        withCloseButton={!form.submitting}
        closeOnEscape={!form.submitting}
        closeOnClickOutside={!form.submitting}
      >
        <Stack>
          <Text>
            Сотрудники больше не смогут входить через Keycloak. Прежние SSO-сессии завершатся. Аккаунтам без локального
            пароля потребуется помощь владельца.
          </Text>
          {isDefined(errorMessage) && (
            <Alert color="red" role="alert">
              {errorMessage}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" disabled={form.submitting} onClick={() => setIsDisableOpened(false)}>
              Отмена
            </Button>
            <Button
              color="red"
              loading={form.submitting}
              onClick={() => {
                form.setFieldValue('enabled', false)
                form.onSubmit(handleSubmit, handleValidationError)()
              }}
            >
              Отключить вход
            </Button>
          </Group>
        </Stack>
      </Modal>
    </>
  )
}
