import { Alert, Button, Loader, Select, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import type { JSX } from 'react'
import { useAccessManagement } from 'domains/admin-access'
import { isDefined } from 'shared/value-predicates'
import { AccountEditor } from './ui/account-editor/account-editor'
import { AccountSecurity } from './ui/account-security/account-security'

/**
 * Предоставляет владельцу управление аккаунтами административной панели.
 *
 * Используется для:
 *  - создания аккаунтов и назначения ролей
 *  - отключения и повторного включения доступа
 */
export const AccountsPanel = (): JSX.Element => {
  const access = useAccessManagement()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  if (access.isLoading) return <Loader aria-label="Загружаем аккаунты" />
  if (access.error !== undefined || access.data === undefined) {
    return <Stack><Alert color="red">Не удалось загрузить аккаунты.</Alert><Button onClick={() => { void access.mutate().catch(() => undefined) }}>Повторить</Button></Stack>
  }
  const accountData = access.data.accounts.find((account) => account.id === selectedId)
  const accountItems = access.data.accounts.map((account) => {
    const statusLabel = account.isActive ? 'активен' : 'отключён'
    return { value: account.id, label: `${account.login} · ${account.role} · ${statusLabel}` }
  })
  const editorKey = `${accountData?.id ?? 'new'}:${accountData?.version ?? 0}`
  return (
    <Stack>
      <Text c="dimmed">Изменение роли или активности отзывает все сессии аккаунта. Последнего активного владельца отключить или понизить нельзя.</Text>
      <Select label="Аккаунт" placeholder="Новый аккаунт" clearable searchable data={accountItems} value={selectedId} onChange={setSelectedId} />
      <AccountEditor key={editorKey} account={accountData} roles={access.data.roles} />
      {isDefined(accountData) && (
        <AccountSecurity key={accountData.id} account={accountData} />
      )}
    </Stack>
  )
}
