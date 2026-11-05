import {
  Avatar,
  Badge,
  Button,
  Group,
  Pagination,
  Paper,
  SegmentedControl,
  Select,
  Stack,
  Text,
  TextInput,
  ThemeIcon,
  Title
} from '@mantine/core'
import { IconArrowRight, IconKey, IconSearch, IconUsers } from '@tabler/icons-react'
import cl from 'clsx'
import type { JSX } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { isEmptyArray, isNonEmptyArray } from 'shared/value-predicates'
import type { UsersListProps } from './types/users-list-props.type'
import styles from './styles/users-list.module.css'

/**
 * Показывает пользователей с поиском, фильтрами и постраничной навигацией.
 *
 * Используется для:
 *  - выбора аккаунта для просмотра и редактирования
 *  - сохранения фильтров в URL при возврате из карточки
 */
export const UsersList = (props: UsersListProps): JSX.Element => {
  const { accounts, roles, currentUserId, className, ...rootAttrs } = props
  const [searchParams, setSearchParams] = useSearchParams()
  const location = useLocation()
  const search = searchParams.get('q') ?? ''
  const roleFilter = searchParams.get('role')
  const statusParameter = searchParams.get('status')
  const statusFilter = statusParameter === 'active' || statusParameter === 'disabled' ? statusParameter : 'all'
  const query = search.trim().toLocaleLowerCase()
  const roleItems = [...new Set(accounts.map((account) => account.role))].map((key) => ({
    value: key,
    label: roles.find((role) => role.key === key)?.name ?? key
  }))
  const filteredAccounts = accounts
    .filter((account) => {
      const matchesQuery = `${account.name} ${account.login}`.toLocaleLowerCase().includes(query)
      const matchesRole = roleFilter === null || account.role === roleFilter
      const matchesStatus = statusFilter === 'all' || account.isActive === (statusFilter === 'active')
      return matchesQuery && matchesRole && matchesStatus
    })
    .sort((first, second) => first.login.localeCompare(second.login, 'ru'))
  const requestedPage = Number(searchParams.get('page') ?? 1)
  const validPage = Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1
  const pageSize = 20
  const totalPages = Math.max(1, Math.ceil(filteredAccounts.length / pageSize))
  const currentPage = Math.min(validPage, totalPages)
  const pageItems = filteredAccounts.slice((currentPage - 1) * pageSize, currentPage * pageSize)
  const hasNoResults = isEmptyArray(pageItems)
  const isEmptyWorkspace = isEmptyArray(accounts)
  const emptyTitle = isEmptyWorkspace ? 'Добавьте первого пользователя' : 'Пользователи не найдены'
  const emptyDescription = isEmptyWorkspace
    ? 'Создайте аккаунт и назначьте ему подходящую роль.'
    : 'Попробуйте другое имя, логин или сбросьте фильтры.'
  const activeCount = accounts.filter((account) => account.isActive).length
  const firstNumber = hasNoResults ? 0 : (currentPage - 1) * pageSize + 1
  const lastNumber = Math.min(currentPage * pageSize, filteredAccounts.length)
  const hasPages = totalPages > 1
  const usersLocation = `${location.pathname}${location.search}`

  /**
   * Сохраняет фильтр и возвращает список на первую страницу.
   */
  const handleFilter = (key: string, value: string | null): void => {
    const next = new URLSearchParams(searchParams)
    next.delete('page')
    if (value === null || value === '' || value === 'all') next.delete(key)
    else next.set(key, value)
    setSearchParams(next, { replace: true, flushSync: true })
  }
  /**
   * Переключает страницу, сохраняя поиск и фильтры.
   */
  const handlePageChange = (page: number): void => {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    setSearchParams(next, { flushSync: true })
  }

  return (
    <div {...rootAttrs} className={cl(styles.root, className)}>
      <Group gap="xl" mb="lg">
        <Text size="sm" c="dimmed">
          Всего пользователей{' '}
          <Text component="span" fw={700} c="var(--mantine-color-text)" ml={6}>
            {accounts.length}
          </Text>
        </Text>
        <Text size="sm" c="dimmed">
          Активны{' '}
          <Text component="span" fw={700} c="teal" ml={6}>
            {activeCount}
          </Text>
        </Text>
        <Text size="sm" c="dimmed">
          Отключены{' '}
          <Text component="span" fw={700} ml={6}>
            {accounts.length - activeCount}
          </Text>
        </Text>
      </Group>
      <Paper withBorder className={styles.surface}>
        <div className={styles.toolbar}>
          <TextInput
            aria-label="Поиск пользователей"
            placeholder="Поиск по имени или логину"
            leftSection={<IconSearch size={17} />}
            value={search}
            onChange={(event) => handleFilter('q', event.currentTarget.value)}
          />
          <Select
            aria-label="Фильтр по роли"
            placeholder="Все роли"
            data={roleItems}
            value={roleFilter}
            clearable
            searchable
            onChange={(value) => handleFilter('role', value)}
          />
          <SegmentedControl
            value={statusFilter}
            onChange={(value) => handleFilter('status', value)}
            data={[
              { value: 'all', label: 'Все' },
              { value: 'active', label: 'Активные' },
              { value: 'disabled', label: 'Отключённые' }
            ]}
          />
        </div>
        <div className={styles.tableHeading} aria-hidden="true">
          <span>Пользователь</span>
          <span>Роль</span>
          <span>Состояние</span>
          <span>Способ входа</span>
          <span />
        </div>
        <ul className={styles.list} aria-label="Список пользователей">
          {pageItems.map((account) => {
            const displayName = account.name.trim() || account.login
            const roleName = roles.find((role) => role.key === account.role)?.name ?? account.role
            const statusLabel = account.isActive ? 'Активен' : 'Отключён'
            const statusColor = account.isActive ? 'teal' : 'gray'
            const isSelf = account.id === currentUserId
            const hasKeycloak = isNonEmptyArray(account.identities)
            const loginMethods =
              [account.hasLocalPassword ? 'Пароль' : '', hasKeycloak ? 'Keycloak' : ''].filter(Boolean).join(' + ') ||
              'Не настроен'
            const accountUrl = `/management/users/${encodeURIComponent(account.id)}`
            const accountLabel = `Открыть пользователя ${displayName}`
            return (
              <li key={account.id}>
                <Link to={accountUrl} state={{ usersLocation }} className={styles.row} aria-label={accountLabel}>
                  <Group wrap="nowrap" gap="md" className={styles.person}>
                    <Avatar name={displayName} color="brand" radius="xl" size={42} />
                    <div className={styles.personCopy}>
                      <Group gap="xs">
                        <Text fw={600} className={styles.name}>
                          {displayName}
                        </Text>
                        {isSelf && (
                          <Badge size="xs" color="gray">
                            Вы
                          </Badge>
                        )}
                      </Group>
                      <Text size="xs" c="dimmed" className={styles.login}>
                        @{account.login}
                      </Text>
                    </div>
                  </Group>
                  <Text size="sm" className={styles.role}>
                    {roleName}
                  </Text>
                  <Badge variant="dot" color={statusColor} className={styles.status}>
                    {statusLabel}
                  </Badge>
                  <Group gap={6} className={styles.methods}>
                    <IconKey size={15} />
                    <Text size="xs">{loginMethods}</Text>
                  </Group>
                  <IconArrowRight size={18} className={styles.arrow} aria-hidden="true" />
                </Link>
              </li>
            )
          })}
        </ul>
        {hasNoResults && (
          <Stack align="center" py={56} px="lg">
            <ThemeIcon size={56} variant="light" color="gray" radius="xl">
              <IconUsers size={28} stroke={1.5} />
            </ThemeIcon>
            <Title order={2} size="h3">
              {emptyTitle}
            </Title>
            <Text c="dimmed" size="sm" ta="center">
              {emptyDescription}
            </Text>
            <Button variant="subtle" onClick={() => setSearchParams({}, { flushSync: true })}>
              Сбросить фильтры
            </Button>
          </Stack>
        )}
        <Group justify="space-between" className={styles.footer}>
          <Text size="xs" c="dimmed">
            Показано {firstNumber}–{lastNumber} из {filteredAccounts.length}
          </Text>
          {hasPages && (
            <Pagination total={totalPages} value={currentPage} onChange={handlePageChange} size="sm" siblings={0} />
          )}
        </Group>
      </Paper>
    </div>
  )
}
