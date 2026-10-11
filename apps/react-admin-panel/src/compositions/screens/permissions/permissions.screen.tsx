import {
  ActionIcon,
  Anchor,
  Badge,
  CopyButton,
  Group,
  Paper,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title,
  Tooltip
} from '@mantine/core'
import { IconCheck, IconCopy, IconLock, IconSearch, IconShieldCheck, IconUser } from '@tabler/icons-react'
import { useState } from 'react'
import type { JSX } from 'react'
import { Link } from 'react-router-dom'
import { describePermission, useAccessManagement } from 'domains/admin-access'
import { isDefined, isEmptyArray } from 'shared/value-predicates'
import { PageHeading } from 'ui/page-heading'
import { QueryState } from 'ui/query-state'
import styles from './styles/permissions.module.css'

/**
 * Объясняет права приложения и показывает использующие их роли.
 *
 * Используется для:
 *  - просмотра каталога действий и перехода к настройке роли
 */
export const PermissionsScreen = (): JSX.Element => {
  const access = useAccessManagement()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('all')
  const accessData = access.data

  if (!isDefined(accessData) || isDefined(access.error)) {
    return (
      <section>
        <PageHeading
          eyebrow="Управление доступом"
          title="Права доступа"
          description="Каталог действий, из которых складываются возможности каждой роли."
        />
        <QueryState
          isLoading={access.isLoading}
          title="Не удалось загрузить права"
          onRetry={() => {
            void access.mutate().catch(() => undefined)
          }}
        />
      </section>
    )
  }

  const query = search.trim().toLocaleLowerCase()
  const permissionItems = accessData.permissions.filter((permission) => {
    const matchesSearch = `${permission.key} ${permission.name} ${describePermission(permission.key).name}`
      .toLocaleLowerCase()
      .includes(query)
    const matchesFilter = filter === 'all' || (filter === 'system' ? permission.system : !permission.system)
    return matchesSearch && matchesFilter
  })
  const groups = [
    { title: 'Личный аккаунт', icon: IconUser, items: permissionItems.filter((permission) => !permission.system) },
    {
      title: 'Администрирование',
      icon: IconShieldCheck,
      items: permissionItems.filter((permission) => permission.system)
    }
  ].filter((group) => !isEmptyArray(group.items))
  const hasNoResults = isEmptyArray(permissionItems)

  return (
    <section className={styles.root}>
      <PageHeading
        eyebrow="Управление доступом"
        title="Права доступа"
        description="Узнайте, что разрешает каждое действие и каким ролям оно доступно."
      />
      <Group justify="space-between" mb="xl" gap="md">
        <TextInput
          className={styles.search}
          aria-label="Поиск права"
          placeholder="Найти действие или технический ключ"
          leftSection={<IconSearch size={17} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
        />
        <SegmentedControl
          value={filter}
          onChange={setFilter}
          data={[
            { value: 'all', label: 'Все' },
            { value: 'custom', label: 'Назначаемые' },
            { value: 'system', label: 'Системные' }
          ]}
        />
      </Group>
      <Stack gap="xl">
        {groups.map((group) => {
          const GroupIcon = group.icon
          return (
            <Paper withBorder key={group.title} className={styles.group}>
              <Group className={styles.groupHeading} gap="sm">
                <ThemeIcon variant="light" color="gray" radius="md">
                  <GroupIcon size={18} />
                </ThemeIcon>
                <Title order={2} size="h3">
                  {group.title}
                </Title>
                <Badge color="gray" size="sm">
                  {group.items.length}
                </Badge>
              </Group>
              {group.items.map((permission) => {
                const details = describePermission(permission.key, permission.name)
                const roleItems = accessData.roles.filter((role) => role.permissions.includes(permission.key))
                const permissionLabel = permission.system ? 'Только владелец' : 'Можно назначить роли'
                const badgeColor = permission.system ? 'orange' : 'gray'
                return (
                  <div className={styles.permission} key={permission.key}>
                    <div>
                      <Group gap="sm">
                        <Text fw={600}>{details.name}</Text>
                        <Badge color={badgeColor} size="sm">
                          {permissionLabel}
                        </Badge>
                      </Group>
                      <Text size="sm" c="dimmed" mt={6} lh={1.6}>
                        {details.description}
                      </Text>
                      <Group gap={6} mt="sm">
                        <Text className={styles.code}>{permission.key}</Text>
                        <CopyButton value={permission.key}>
                          {({ copied, copy }) => {
                            const CopyIcon = copied ? IconCheck : IconCopy
                            const copyLabel = copied ? 'Скопировано' : 'Скопировать ключ'
                            return (
                              <Tooltip label={copyLabel}>
                                <ActionIcon
                                  variant="subtle"
                                  color="gray"
                                  size="sm"
                                  onClick={copy}
                                  aria-label={copyLabel}
                                >
                                  <CopyIcon size={14} />
                                </ActionIcon>
                              </Tooltip>
                            )
                          }}
                        </CopyButton>
                      </Group>
                    </div>
                    <div className={styles.roles}>
                      <Text size="xs" c="dimmed" mb={8}>
                        Доступно ролям
                      </Text>
                      <Group gap="xs">
                        {roleItems.map((role) => (
                          <Anchor
                            component={Link}
                            to={`/management/roles/${encodeURIComponent(role.key)}`}
                            key={role.key}
                            size="sm"
                          >
                            {role.name}
                          </Anchor>
                        ))}
                      </Group>
                    </div>
                  </div>
                )
              })}
            </Paper>
          )
        })}
        {hasNoResults && (
          <Paper withBorder p={40} ta="center">
            <Title order={2} size="h3">
              Ничего не найдено
            </Title>
            <Text c="dimmed" mt="sm">
              Измените запрос или выберите другую категорию.
            </Text>
          </Paper>
        )}
      </Stack>
      <Group mt="xl" gap="xs" wrap="nowrap" align="flex-start">
        <IconLock size={16} className={styles.noteIcon} />
        <Text size="sm" c="dimmed">
          Права определяются приложением. Чтобы изменить доступ пользователя, настройте его роль.
        </Text>
      </Group>
    </section>
  )
}
