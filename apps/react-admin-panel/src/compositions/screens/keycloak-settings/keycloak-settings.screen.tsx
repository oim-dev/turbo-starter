import { Alert, Button, Loader, Stack, Text, Title } from '@mantine/core'
import { useState } from 'react'
import type { JSX } from 'react'
import { useKeycloakSettings } from 'domains/keycloak-settings'
import { KeycloakForm } from './ui/keycloak-form/keycloak-form'

/**
 * Предоставляет владельцу настройку корпоративного входа.
 *
 * Используется для:
 *  - включения Keycloak и замены его конфигурации
 */
export const KeycloakSettingsScreen = (): JSX.Element => {
  const settings = useKeycloakSettings()
  const [isSaved, setIsSaved] = useState(false)
  if (settings.isLoading) return <Loader aria-label="Загружаем настройки Keycloak" />
  if (settings.error !== undefined || settings.data === undefined) {
    return <Stack><Alert color="red">Не удалось загрузить настройки Keycloak.</Alert><Button onClick={() => { void settings.mutate().catch(() => undefined) }}>Повторить загрузку</Button></Stack>
  }
  return (
    <Stack component="section" gap="lg">
      <Title order={1}>Keycloak</Title>
      <Text c="dimmed">Необязательный способ входа. Локальный вход сохраняется. Настройки применяются без перезапуска API.</Text>
      {isSaved && (
        <Alert color="green" role="status">Настройки сохранены. Прежние SSO-сессии и незавершённые входы отозваны.</Alert>
      )}
      <KeycloakForm key={settings.data.version} settings={settings.data} onSaved={() => setIsSaved(true)} />
    </Stack>
  )
}
