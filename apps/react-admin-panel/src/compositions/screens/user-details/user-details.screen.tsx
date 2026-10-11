import { Alert, Avatar, Badge, Button, Group, Paper, Stack, Tabs, Text, Title } from '@mantine/core'
import { IconArrowLeft, IconLock, IconUser } from '@tabler/icons-react'
import type { JSX } from 'react'
import { Link, useLocation, useMatch, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useAccessManagement } from 'domains/admin-access'
import type { ManagedAccount } from 'domains/admin-access'
import { useGetCurrentUser, usePermission } from 'domains/auth'
import { isDefined, isRecord, isString } from 'shared/value-predicates'
import { getSafeReturnTo } from 'shared/navigation'
import { PageHeading } from 'ui/page-heading'
import { QueryState } from 'ui/query-state'
import { AccountEditor } from './ui/account-editor/account-editor'
import { AccountSecurity } from './ui/account-security/account-security'
import styles from './styles/user-details.module.css'

/**
 * Предоставляет индивидуальную страницу пользователя и сценарий его создания.
 *
 * Используется для:
 *  - редактирования профиля и назначенного доступа
 *  - управления способами входа и сессиями
 */
export const UserDetailsScreen = (): JSX.Element => {
  const access = useAccessManagement()
  const currentUser = useGetCurrentUser()
  const canManage = usePermission('system.access.manage')
  const { accountId } = useParams()
  const isCreating = useMatch('/management/users/new') !== null
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const accessData = access.data
  const stateData: unknown = location.state
  const storedLocation = isRecord(stateData) && isString(stateData.usersLocation) ? stateData.usersLocation : ''
  const canonicalLocation = getSafeReturnTo(storedLocation)
  const isUsersLocation = /^\/management\/users\/?(?:[?#]|$)/.test(canonicalLocation)
  const returnTo = isUsersLocation ? canonicalLocation : '/management/users'
  const activeTab = canManage && searchParams.get('tab') === 'security' ? 'security' : 'profile'

  /**
   * Открывает созданный аккаунт, сохраняя путь возврата к списку.
   */
  const handleCreated = (account: ManagedAccount): void => {
    void navigate(`/management/users/${encodeURIComponent(account.id)}`, {
      replace: true,
      state: { usersLocation: returnTo }
    })
  }

  /**
   * Сохраняет выбранную вкладку в URL с участием защиты черновика.
   */
  const handleTabChange = (tab: string | null): void => {
    setSearchParams(tab === 'security' ? { tab } : {}, { state: { usersLocation: returnTo } })
  }

  if (!isDefined(accessData)) {
    return (
      <section>
        <PageHeading
          eyebrow="Управление доступом"
          title="Пользователь"
          description="Профиль, доступ и безопасность учётной записи."
        />
        <QueryState
          isLoading={access.isLoading}
          title="Не удалось загрузить пользователя"
          onRetry={() => {
            void access.mutate().catch(() => undefined)
          }}
        />
      </section>
    )
  }
  if (isCreating) {
    return (
      <section className={styles.root}>
        <Button
          component={Link}
          to={returnTo}
          variant="subtle"
          size="xs"
          leftSection={<IconArrowLeft size={15} />}
          mb="lg"
        >
          Все пользователи
        </Button>
        <PageHeading
          eyebrow="Управление доступом / Пользователи"
          title="Новый пользователь"
          description="Создайте учётную запись и выберите возможности, которые ей нужны."
        />
        <AccountEditor roles={accessData.roles} isLastOwner={false} returnTo={returnTo} onCreated={handleCreated} />
      </section>
    )
  }

  const accountData = accessData.accounts.find((account) => account.id === accountId)
  if (!isDefined(accountData)) {
    return (
      <Paper withBorder p="xl">
        <Stack align="center" py="xl">
          <Title order={1} size="h2">
            Пользователь не найден
          </Title>
          <Text c="dimmed" ta="center">
            Возможно, аккаунт больше не существует. Вернитесь к списку пользователей.
          </Text>
          <Button component={Link} to={returnTo} variant="default">
            Все пользователи
          </Button>
        </Stack>
      </Paper>
    )
  }
  const displayName = accountData.name.trim() || accountData.login
  const roleName = accessData.roles.find((role) => role.key === accountData.role)?.name ?? accountData.role
  const statusLabel = accountData.isActive ? 'Активен' : 'Отключён'
  const statusColor = accountData.isActive ? 'teal' : 'gray'
  const isSelf = currentUser.data?.id === accountData.id
  const activeOwnerCount = accessData.accounts.filter((account) => account.role === 'OWNER' && account.isActive).length
  const isLastOwner = accountData.role === 'OWNER' && accountData.isActive && activeOwnerCount === 1

  return (
    <section className={styles.root}>
      <Button
        component={Link}
        to={returnTo}
        variant="subtle"
        size="xs"
        leftSection={<IconArrowLeft size={15} />}
        mb="xl"
      >
        Все пользователи
      </Button>
      <div className={styles.hero}>
        <Group gap="lg" wrap="nowrap" className={styles.identity}>
          <Avatar name={displayName} size={64} radius={20} color="brand" />
          <div className={styles.identityCopy}>
            <Text className={styles.eyebrow}>Профиль пользователя</Text>
            <Title order={1} className={styles.title}>
              {displayName}
            </Title>
            <Text size="sm" c="dimmed" className={styles.login}>
              @{accountData.login}
            </Text>
          </div>
        </Group>
        <Group gap="sm">
          {isSelf && (
            <Badge color="brand">Это вы</Badge>
          )}
          <Badge size="lg" color="gray">
            {roleName}
          </Badge>
          <Badge size="lg" variant="dot" color={statusColor}>
            {statusLabel}
          </Badge>
        </Group>
      </div>
      {isDefined(access.error) && (
        <Alert color="orange" mb="lg">
          Не удалось обновить данные. Показана последняя загруженная версия.
        </Alert>
      )}
      <Tabs value={activeTab} onChange={handleTabChange} keepMounted={false}>
        <Tabs.List mb="xl">
          <Tabs.Tab value="profile" leftSection={<IconUser size={17} />}>
            Профиль и доступ
          </Tabs.Tab>
          {canManage && (
            <Tabs.Tab value="security" leftSection={<IconLock size={17} />}>
              Безопасность
            </Tabs.Tab>
          )}
        </Tabs.List>
        <Tabs.Panel value="profile">
          <AccountEditor
            key={accountData.id}
            account={accountData}
            roles={accessData.roles}
            isLastOwner={isLastOwner}
            returnTo={returnTo}
            onCreated={handleCreated}
          />
        </Tabs.Panel>
        {canManage && (
          <Tabs.Panel value="security">
            <AccountSecurity key={accountData.id} account={accountData} />
          </Tabs.Panel>
        )}
      </Tabs>
    </section>
  )
}
