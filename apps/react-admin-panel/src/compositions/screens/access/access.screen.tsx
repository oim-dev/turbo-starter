import { Stack, Tabs, Text, Title } from '@mantine/core'
import type { JSX } from 'react'
import { AccountsPanel } from './ui/accounts-panel'
import { RolesPanel } from './ui/roles-panel'

/**
 * Собирает управление аккаунтами и ролями административной панели.
 *
 * Используется для:
 *  - управления доступом владельцем сервиса
 */
export const AccessScreen = (): JSX.Element => {
  return (
    <Stack component="section" gap="lg">
      <Title order={1}>Управление доступом</Title>
      <Text c="dimmed">Аккаунты админки, роли и разрешённые действия. Системные настройки доступны только владельцу.</Text>
      <Tabs defaultValue="accounts" keepMounted={false}>
        <Tabs.List>
          <Tabs.Tab value="accounts">Аккаунты</Tabs.Tab>
          <Tabs.Tab value="roles">Роли и permissions</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="accounts" pt="lg"><AccountsPanel /></Tabs.Panel>
        <Tabs.Panel value="roles" pt="lg"><RolesPanel /></Tabs.Panel>
      </Tabs>
    </Stack>
  )
}
