import {
  Alert,
  Badge,
  Button,
  Fieldset,
  Group,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title
} from '@mantine/core'
import { useForm } from '@mantine/form'
import { IconCheck, IconDeviceDesktop, IconKey, IconLink, IconPlus } from '@tabler/icons-react'
import { useState } from 'react'
import type { JSX } from 'react'
import { AccessError, useAccessManagement } from 'domains/admin-access'
import { isAuthError, logout, useGetCurrentUser } from 'domains/auth'
import { reportApplicationDefect, toApplicationDefect } from 'shared/errors'
import { isDefined, isEmptyArray } from 'shared/value-predicates'
import { FormLeaveGuard } from 'ui/form-leave-guard'
import type {
  AccountSecurityProps,
  IdentityFormValues,
  SecurityConfirmation
} from './types/account-security-props.type'
import { AccountPasswordDialog } from './ui/account-password-dialog/account-password-dialog'
import styles from './styles/account-security.module.css'

/**
 * Управляет способами входа и сессиями на индивидуальной странице пользователя.
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
  const [isBindingOpened, setIsBindingOpened] = useState(false)
  const [isPasswordOpened, setIsPasswordOpened] = useState(false)
  const [confirmation, setConfirmation] = useState<SecurityConfirmation | null>(null)
  const form = useForm<IdentityFormValues>({
    mode: 'uncontrolled',
    validateInputOnBlur: true,
    initialValues: { issuer: account.identities[0]?.issuer ?? '', subject: '' },
    validate: {
      issuer: (value) => (/^https?:\/\//.test(value) && value.length <= 512 ? null : 'Введите issuer realm'),
      subject: (value) => (value.trim() !== '' && value.length <= 255 ? null : 'Введите точный sub (до 255 символов)')
    }
  })
  const isDisabled = form.submitting || isActing
  const identityItems = account.identities
  const hasNoIdentities = isEmptyArray(identityItems)
  const canDisablePassword = account.hasLocalPassword && (!account.isActive || !hasNoIdentities)
  const isDisablePasswordDisabled = isDisabled || !canDisablePassword
  const passwordLabel = account.hasLocalPassword ? 'Включён' : 'Не задан'
  const passwordColor = account.hasLocalPassword ? 'teal' : 'gray'
  const canUnbind = account.hasLocalPassword || !account.isActive || identityItems.length > 1
  const isUnbindDisabled = isDisabled || !canUnbind
  const displayName = account.name.trim() || account.login
  const isConfirmOpened = isDefined(confirmation)
  const confirmTitle = confirmation?.title ?? 'Подтвердите действие'
  const confirmDescription = confirmation?.description ?? ''
  const shouldExplainPassword = account.hasLocalPassword && !canDisablePassword
  const shouldExplainIdentity = !hasNoIdentities && !canUnbind

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
    if (error instanceof AccessError) {
      setErrorMessage(error.message)
      return
    }
    if (isAuthError(error)) {
      setErrorMessage('Сессия завершена. Войдите снова.')
      return
    }
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
      setIsBindingOpened(false)
      setSuccessMessage('Привязка сохранена. Прежние сессии аккаунта отозваны.')
      await finishChange()
    } catch (error) {
      handleFailure(error)
    }
  }

  /**
   * Выполняет отдельное действие над доступом без повторной отправки.
   */
  const handleConfirm = async (): Promise<void> => {
    if (!isDefined(confirmation)) return
    setIsActing(true)
    setErrorMessage(null)
    setSuccessMessage(null)
    try {
      await confirmation.onConfirm()
      setConfirmation(null)
      setSuccessMessage('Изменение применено. Прежние сессии аккаунта отозваны.')
      await finishChange()
    } catch (error) {
      handleFailure(error)
    } finally {
      setIsActing(false)
    }
  }

  /**
   * Закрывает форму привязки и удаляет несохранённый ввод.
   */
  const handleCloseBinding = (): void => {
    form.reset()
    setIsBindingOpened(false)
    setErrorMessage(null)
  }

  /**
   * Обрабатывает успешное изменение пароля и собственную отозванную сессию.
   */
  const handlePasswordSaved = async (): Promise<void> => {
    setIsPasswordOpened(false)
    setSuccessMessage('Новый пароль сохранён. Прежние сессии пользователя завершены.')
    await finishChange()
  }

  /**
   * Подготавливает подтверждение операции без её предварительного выполнения.
   */
  const handleRequestConfirmation = (action: SecurityConfirmation): void => {
    setErrorMessage(null)
    setSuccessMessage(null)
    setConfirmation(action)
  }

  /**
   * Фокусирует первое некорректное поле привязки.
   */
  const handleValidationError = (errors: typeof form.errors): void => {
    const first = Object.keys(errors)[0]
    if (first !== undefined) form.getInputNode(first)?.focus()
  }

  return (
    <>
      <FormLeaveGuard shouldBlock={form.isDirty} />
      <div className={styles.root}>
        <Paper withBorder className={styles.panel}>
          <Group justify="space-between" mb="lg">
            <ThemeIcon variant="light" size={42} radius="lg">
              <IconKey size={23} />
            </ThemeIcon>
            <Badge color={passwordColor}>{passwordLabel}</Badge>
          </Group>
          <Title order={2} size="h3">
            Вход по паролю
          </Title>
          <Text c="dimmed" size="sm" mt="sm" lh={1.7}>
            Задайте новый пароль, если пользователь забыл прежний или ему нужен локальный способ входа.
          </Text>
          <SimpleGrid type="container" cols={{ base: 1, '29em': 2 }} spacing="sm" mt="xl">
            <Button
              variant="default"
              disabled={isDisabled}
              onClick={() => {
                setSuccessMessage(null)
                setErrorMessage(null)
                setIsPasswordOpened(true)
              }}
            >
              Задать новый пароль
            </Button>
            {account.hasLocalPassword && (
              <Button
                variant="subtle"
                color="red"
                disabled={isDisablePasswordDisabled}
                onClick={() =>
                  handleRequestConfirmation({
                    title: 'Отключить вход по паролю?',
                    description:
                      'Локальный пароль будет удалён, а прежние сессии завершены. Для входа потребуется настроенный Keycloak.',
                    onConfirm: () => access.disablePassword(account.id)
                  })
                }
              >
                Отключить вход по паролю
              </Button>
            )}
          </SimpleGrid>
          {shouldExplainPassword && (
            <Text c="dimmed" size="xs" mt="md">
              Сначала привяжите Keycloak: у активного пользователя должен остаться способ входа.
            </Text>
          )}
        </Paper>
        <Paper withBorder className={styles.panel}>
          <Group justify="space-between" mb="lg">
            <ThemeIcon variant="light" size={42} radius="lg">
              <IconLink size={23} />
            </ThemeIcon>
            <Badge color="gray">Привязок: {identityItems.length}</Badge>
          </Group>
          <Title order={2} size="h3">
            Корпоративный вход
          </Title>
          <Text c="dimmed" size="sm" mt="sm" lh={1.7}>
            Свяжите аккаунт панели с учётной записью сотрудника в Keycloak.
          </Text>
          {hasNoIdentities && (
            <Text size="sm" c="dimmed" mt="lg">
              Keycloak пока не привязан.
            </Text>
          )}
          <Stack gap="sm" mt="lg">
            {identityItems.map((identity) => (
              <div key={identity.id} className={styles.identity}>
                <Text size="xs" c="dimmed">
                  Issuer
                </Text>
                <Text className={styles.identityValue} size="sm">
                  {identity.issuer}
                </Text>
                <Text size="xs" c="dimmed" mt="sm">
                  Subject (sub)
                </Text>
                <Text className={styles.identityValue} size="sm">
                  {identity.subject}
                </Text>
                <Button
                  variant="subtle"
                  color="red"
                  size="xs"
                  mt="sm"
                  disabled={isUnbindDisabled}
                  onClick={() =>
                    handleRequestConfirmation({
                      title: 'Отвязать Keycloak?',
                      description:
                        'Вход через эту учётную запись Keycloak станет недоступен. Прежние сессии пользователя завершатся.',
                      onConfirm: () => access.unbindIdentity(account.id, identity.id)
                    })
                  }
                >
                  Отвязать
                </Button>
              </div>
            ))}
          </Stack>
          {shouldExplainIdentity && (
            <Text size="xs" c="dimmed" mt="sm">
              Это единственный способ входа. Перед удалением задайте локальный пароль.
            </Text>
          )}
          <Button
            variant="default"
            mt="lg"
            disabled={isDisabled}
            leftSection={<IconPlus size={16} />}
            onClick={() => {
              setErrorMessage(null)
              setSuccessMessage(null)
              setIsBindingOpened(true)
            }}
          >
            Привязать Keycloak
          </Button>
        </Paper>
        <Paper withBorder className={styles.sessions}>
          <Group justify="space-between" gap="xl">
            <Group wrap="nowrap" gap="md" align="flex-start">
              <ThemeIcon variant="light" color="gray" size={42} radius="lg">
                <IconDeviceDesktop size={23} />
              </ThemeIcon>
              <div>
                <Title order={2} size="h3">
                  Сессии пользователя
                </Title>
                <Text size="sm" c="dimmed" mt="sm" maw={470} lh={1.7}>
                  Завершите вход на всех устройствах. Аккаунт останется активным, но пользователю потребуется войти
                  снова.
                </Text>
              </div>
            </Group>
            <Button
              variant="light"
              color="red"
              disabled={isDisabled}
              onClick={() =>
                handleRequestConfirmation({
                  title: 'Завершить все сессии?',
                  description:
                    'Пользователь будет выведен из панели на всех устройствах. Если это ваш аккаунт, текущая сессия тоже завершится.',
                  onConfirm: () => access.revokeSessions(account.id)
                })
              }
            >
              Завершить все сессии
            </Button>
          </Group>
        </Paper>
      </div>
      {isDefined(errorMessage) && (
        <Alert color="red" role="alert" mt="lg">
          {errorMessage}
        </Alert>
      )}
      {isDefined(successMessage) && (
        <Alert color="teal" role="status" icon={<IconCheck size={18} />} mt="lg">
          {successMessage}
        </Alert>
      )}
      <Modal
        opened={isBindingOpened}
        onClose={handleCloseBinding}
        title="Привязать Keycloak"
        withCloseButton={!form.submitting}
        closeOnEscape={!form.submitting}
        closeOnClickOutside={!form.submitting}
      >
        <form noValidate onSubmit={form.onSubmit(handleBind, handleValidationError)}>
          <Fieldset variant="unstyled" disabled={form.submitting}>
            <Stack gap="lg">
              <Text size="sm" c="dimmed">
                Укажите Issuer realm и неизменяемый Subject пользователя. Email и логин Keycloak для привязки не
                подходят.
              </Text>
              <TextInput
                label="Issuer URL"
                placeholder="https://sso.company.ru/realms/company"
                required
                key={form.key('issuer')}
                {...form.getInputProps('issuer')}
              />
              <TextInput label="Subject (sub)" required key={form.key('subject')} {...form.getInputProps('subject')} />
              <Text size="xs" c="dimmed">
                Привязка завершит прежние сессии пользователя.
              </Text>
              {isDefined(errorMessage) && (
                <Alert color="red" role="alert">
                  {errorMessage}
                </Alert>
              )}
              <Group justify="flex-end">
                <Button variant="default" onClick={handleCloseBinding}>
                  Отмена
                </Button>
                <Button type="submit" loading={form.submitting}>
                  Привязать
                </Button>
              </Group>
            </Stack>
          </Fieldset>
        </form>
      </Modal>
      <Modal
        opened={isConfirmOpened}
        onClose={() => setConfirmation(null)}
        title={confirmTitle}
        withCloseButton={!isActing}
        closeOnEscape={!isActing}
        closeOnClickOutside={!isActing}
      >
        <Stack>
          <Text size="sm" lh={1.7}>
            {confirmDescription}
          </Text>
          {isDefined(errorMessage) && (
            <Alert color="red" role="alert">
              {errorMessage}
            </Alert>
          )}
          <Group justify="flex-end">
            <Button variant="default" disabled={isActing} onClick={() => setConfirmation(null)}>
              Отмена
            </Button>
            <Button color="red" loading={isActing} onClick={handleConfirm}>
              Подтвердить
            </Button>
          </Group>
        </Stack>
      </Modal>
      {isPasswordOpened && (
        <AccountPasswordDialog
          accountId={account.id}
          version={account.version}
          displayName={displayName}
          onClose={() => setIsPasswordOpened(false)}
          onSaved={handlePasswordSaved}
        />
      )}
    </>
  )
}
