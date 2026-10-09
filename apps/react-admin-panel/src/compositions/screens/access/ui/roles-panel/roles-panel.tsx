import { Alert, Button, Loader, Select, Stack, Text } from '@mantine/core'
import { useState } from 'react'
import type { JSX } from 'react'
import { useAccessManagement } from 'domains/admin-access'
import { RoleEditor } from './ui/role-editor/role-editor'

/**
 * Предоставляет выбор, создание и редактирование ролей.
 *
 * Используется для:
 *  - назначения permissions дополнительным ролям
 */
export const RolesPanel = (): JSX.Element => {
  const access = useAccessManagement()
  const [selectedKey, setSelectedKey] = useState<string | null>(null)
  if (access.isLoading) return <Loader aria-label="Загружаем роли" />
  if (access.error !== undefined || access.data === undefined) {
    return <Stack><Alert color="red">Не удалось загрузить роли.</Alert><Button onClick={() => { void access.mutate().catch(() => undefined) }}>Повторить</Button></Stack>
  }
  const roleData = access.data.roles.find((role) => role.key === selectedKey)
  const roleItems = access.data.roles.map((role) => ({ value: role.key, label: `${role.name} (${role.key})` }))
  const editorKey = `${roleData?.key ?? 'new'}:${roleData?.version ?? 0}`
  return (
    <Stack>
      <Text c="dimmed">OWNER — все права. ADMIN — все несистемные действия. USER — собственный аккаунт. Встроенные роли неизменяемы.</Text>
      <Select label="Редактируемая роль" placeholder="Новая роль" clearable searchable data={roleItems} value={selectedKey} onChange={setSelectedKey} />
      <RoleEditor key={editorKey} role={roleData} permissions={access.data.permissions} onDeleted={() => setSelectedKey(null)} />
    </Stack>
  )
}
