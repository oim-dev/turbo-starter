import useSWR from 'swr'
import type { SWRResponse } from 'swr'
import { useGetCurrentUser } from 'domains/auth'
import { getKeycloakSettings, saveKeycloakSettings } from '../adapters/keycloak-settings.adapter'
import type { KeycloakSettingsError } from '../errors/keycloak-settings.error'
import type { KeycloakSettings, KeycloakSettingsInput } from '../types/keycloak-settings.type'

/**
 * Настройки и действие сохранения с обновлением кеша.
 */
type KeycloakSettingsState = SWRResponse<KeycloakSettings, KeycloakSettingsError> & {
  /**
   * Сохранить ожидаемую версию конфигурации.
   */
  save: typeof saveKeycloakSettings
}

/**
 * Владеет приватным кешем настроек и синхронизацией успешной записи.
 */
export const useKeycloakSettings = (): KeycloakSettingsState => {
  const profile = useGetCurrentUser()
  const canManage = profile.error === undefined && profile.data?.permissions.includes('system.keycloak.manage') === true
  const key = canManage ? ['keycloak-settings', profile.data?.id] : null
  const query = useSWR<KeycloakSettings, KeycloakSettingsError>(key, getKeycloakSettings, { shouldRetryOnError: false, revalidateOnFocus: false })
  /**
   * Обновляет кеш только подтверждённым сервером результатом.
   */
  const save = async (input: KeycloakSettingsInput): Promise<KeycloakSettings> => {
    const settings = await saveKeycloakSettings(input)
    await query.mutate(settings, { revalidate: false })
    return settings
  }
  return { ...query, save }
}
