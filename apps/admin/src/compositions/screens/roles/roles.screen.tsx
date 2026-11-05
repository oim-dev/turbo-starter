import {
  Badge,
  Button,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  UnstyledButton
} from '@mantine/core'
import {
  IconArrowLeft,
  IconArrowRight,
  IconPlus,
  IconSearch,
  IconShield,
  IconShieldCheck,
  IconUsers
} from '@tabler/icons-react'
import { useState } from 'react'
import type { JSX } from 'react'
import { Link, useMatch, useParams } from 'react-router-dom'
import { useAccessManagement } from 'domains/management/access'
import { isDefined, isEmptyArray } from 'shared/value-predicates'
import { PageHeading } from 'ui/page-heading'
import { QueryState } from 'ui/query-state'
import { RoleEditor } from './ui/role-editor/role-editor'
import styles from './styles/roles.module.css'

/**
 * Предоставляет выбор, создание и редактирование ролей.
 *
 * Используется для:
 *  - назначения permissions дополнительным ролям
 */
export const RolesScreen = (): JSX.Element => {
  const access = useAccessManagement()
  const { roleKey } = useParams()
  const isCreating = useMatch('/management/roles/new') !== null
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const accessData = access.data
  const isEditing = isCreating || isDefined(roleKey)

  if (!isDefined(accessData) || isDefined(access.error)) {
    return (
      <section>
        <PageHeading
          eyebrow="Управление доступом"
          title="Роли"
          description="Объединяйте права в роли и назначайте их пользователям."
        />
        <QueryState
          isLoading={access.isLoading}
          title="Не удалось загрузить роли"
          onRetry={() => {
            void access.mutate().catch(() => undefined)
          }}
        />
      </section>
    )
  }

  if (isEditing) {
    const roleData = accessData.roles.find((role) => role.key === roleKey)
    if (!isCreating && !isDefined(roleData)) {
      return (
        <Paper withBorder p="xl">
          <Stack align="center" py="xl">
            <Title order={1} size="h2">
              Роль не найдена
            </Title>
            <Text c="dimmed">Возможно, её уже удалили. Вернитесь к актуальному списку.</Text>
            <Button component={Link} to="/management/roles" variant="default">
              К списку ролей
            </Button>
          </Stack>
        </Paper>
      )
    }
    const assignedAccounts = accessData.accounts.filter((account) => account.role === roleKey)
    return (
      <section>
        <Button
          component={Link}
          to="/management/roles"
          variant="subtle"
          size="xs"
          leftSection={<IconArrowLeft size={15} />}
          mb="lg"
        >
          Все роли
        </Button>
        <RoleEditor
          key={roleKey ?? 'new'}
          role={roleData}
          permissions={accessData.permissions}
          accounts={assignedAccounts}
        />
      </section>
    )
  }

  const query = search.trim().toLocaleLowerCase()
  const roleItems = accessData.roles.filter((role) => {
    const matchesSearch = `${role.name} ${role.key}`.toLocaleLowerCase().includes(query)
    const matchesFilter = filter === 'all' || (filter === 'builtin' ? role.isBuiltin : !role.isBuiltin)
    return matchesSearch && matchesFilter
  })
  const hasNoResults = isEmptyArray(roleItems)

  return (
    <section>
      <PageHeading
        eyebrow="Управление доступом"
        title="Роли"
        description="Нужные возможности — нужным людям. Управляйте наборами прав вашего рабочего пространства."
        action={
          <Button component={Link} to="/management/roles/new" leftSection={<IconPlus size={17} />}>
            Создать роль
          </Button>
        }
      />
      <Paper withBorder className={styles.root}>
        <Group justify="space-between" className={styles.toolbar}>
          <TextInput
            aria-label="Поиск роли"
            placeholder="Найти роль по названию или ключу"
            leftSection={<IconSearch size={17} />}
            value={search}
            onChange={(event) => setSearch(event.currentTarget.value)}
            className={styles.search}
          />
          <SegmentedControl
            value={filter}
            onChange={setFilter}
            data={[
              { value: 'all', label: 'Все' },
              { value: 'builtin', label: 'Встроенные' },
              { value: 'custom', label: 'Пользовательские' }
            ]}
          />
        </Group>
        <div className={styles.tableHeading} aria-hidden="true">
          <span>Роль</span>
          <span>Тип</span>
          <span>Права</span>
          <span>Пользователи</span>
          <span />
        </div>
        {roleItems.map((role) => {
          const roleUrl = `/management/roles/${encodeURIComponent(role.key)}`
          const roleType = role.isBuiltin ? 'Встроенная' : 'Пользовательская'
          const roleIcon = role.isBuiltin ? IconShieldCheck : IconShield
          const RoleIcon = roleIcon
          const usersCount = accessData.accounts.filter((account) => account.role === role.key).length
          const permissionsLabel = role.key === 'OWNER' ? 'Все права' : `Прав: ${role.permissions.length}`
          return (
            <UnstyledButton component={Link} to={roleUrl} className={styles.row} key={role.key}>
              <Group wrap="nowrap" gap="md">
                <ThemeIcon variant="light" color="brand" radius="lg" size={42}>
                  <RoleIcon size={22} stroke={1.6} />
                </ThemeIcon>
                <div className={styles.roleCopy}>
                  <Text fw={600} className={styles.name}>
                    {role.name}
                  </Text>
                  <Text className={styles.code}>{role.key}</Text>
                </div>
              </Group>
              <Badge color="gray" className={styles.type}>
                {roleType}
              </Badge>
              <Text size="sm" c="dimmed" className={styles.permissions}>
                {permissionsLabel}
              </Text>
              <Group gap={6} className={styles.users}>
                <IconUsers size={16} />
                <Text size="sm">{usersCount}</Text>
              </Group>
              <IconArrowRight size={18} className={styles.arrow} />
            </UnstyledButton>
          )
        })}
        {hasNoResults && (
          <Stack align="center" py={60} px="lg">
            <ThemeIcon size={52} radius="xl" variant="light" color="gray">
              <IconSearch size={25} />
            </ThemeIcon>
            <Title order={2} size="h3">
              Подходящих ролей нет
            </Title>
            <Text c="dimmed" ta="center">
              Попробуйте изменить запрос или сбросить фильтры.
            </Text>
            <Button
              variant="subtle"
              onClick={() => {
                setSearch('')
                setFilter('all')
              }}
            >
              Сбросить фильтры
            </Button>
          </Stack>
        )}
        <Text className={styles.footer}>
          Показано {roleItems.length} из {accessData.roles.length} · Встроенные роли доступны только для просмотра
        </Text>
      </Paper>
    </section>
  )
}
