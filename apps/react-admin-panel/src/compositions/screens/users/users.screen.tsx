import { Button } from '@mantine/core'
import { IconPlus } from '@tabler/icons-react'
import type { JSX } from 'react'
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom'
import { useAccessManagement } from 'domains/admin-access'
import { useGetCurrentUser, usePermission } from 'domains/auth'
import { isDefined } from 'shared/value-predicates'
import { PageHeading } from 'ui/page-heading'
import { QueryState } from 'ui/query-state'
import { UsersList } from './ui/users-list'

/**
 * Предоставляет обзор пользователей и переход к их индивидуальным страницам.
 *
 * Используется для:
 *  - поиска пользователей и создания нового аккаунта
 */
export const UsersScreen = (): JSX.Element => {
  const access = useAccessManagement()
  const currentUser = useGetCurrentUser()
  const canManage = usePermission('system.access.manage')
  const [searchParams] = useSearchParams()
  const location = useLocation()
  const legacyAccountId = searchParams.get('account')
  const accessData = access.data
  if (isDefined(legacyAccountId)) {
    const remainingParameters = new URLSearchParams(searchParams)
    remainingParameters.delete('account')
    const remainingQuery = remainingParameters.toString()
    const targetLocation = {
      pathname: `/management/users/${encodeURIComponent(legacyAccountId)}`,
      search: remainingQuery === '' ? '' : `?${remainingQuery}`,
      hash: location.hash
    }
    return <Navigate to={targetLocation} state={location.state} replace />
  }
  if (!isDefined(accessData)) {
    return (
      <section>
        <PageHeading
          eyebrow="Управление доступом"
          title="Пользователи админки"
          description="Учётные записи сотрудников для работы в панели. Профили, роли и способы входа."
        />
        <QueryState
          isLoading={access.isLoading}
          title="Не удалось загрузить пользователей"
          onRetry={() => {
            void access.mutate().catch(() => undefined)
          }}
        />
      </section>
    )
  }
  return (
    <section>
      <PageHeading
        eyebrow="Управление доступом"
        title="Пользователи админки"
        description="Учётные записи сотрудников для работы в панели. Профили, роли и способы входа."
        action={
          canManage && (
            <Button component={Link} to="/management/users/new" leftSection={<IconPlus size={17} />}>
              Добавить пользователя
            </Button>
          )
        }
      />
      <UsersList accounts={accessData.accounts} roles={accessData.roles} currentUserId={currentUser.data?.id} />
    </section>
  )
}
