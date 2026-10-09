import { rejectAuthentication } from 'domains/auth'
import { backendAdminApi, getBackendAdminApiErrorAccessToken, isBackendAdminApiError } from 'infra/backend-admin-api'
import { toApplicationDefect } from 'shared/errors'
import { KeycloakSettingsError } from '../errors/keycloak-settings.error'
import { mapKeycloakSettings } from '../mappers/keycloak-settings.mapper'
import type { KeycloakSettings, KeycloakSettingsInput } from '../types/keycloak-settings.type'

/**
 * Загружает настройки для владельца с безопасным контрактом ошибок SWR.
 */
export const getKeycloakSettings = async (): Promise<KeycloakSettings> => {
  try {
    return mapKeycloakSettings(await backendAdminApi.settings.adminKeycloakSettingsGet())
  } catch (error) {
    if (isBackendAdminApiError(error) && error.status === 401) {
      rejectAuthentication(getBackendAdminApiErrorAccessToken(error))
    }
    throw new KeycloakSettingsError('Не удалось загрузить настройки. Проверьте сессию и повторите загрузку.')
  }
}
/**
 * Сохраняет конфигурацию и возвращает подтверждённое состояние без секрета.
 */
export const saveKeycloakSettings = async (input: KeycloakSettingsInput): Promise<KeycloakSettings> => {
  try {
    return mapKeycloakSettings(await backendAdminApi.settings.adminKeycloakSettingsUpdate({
      enabled: input.enabled,
      issuer: input.issuer,
      clientId: input.clientId,
      clientSecret: input.clientSecret,
      clearSecret: input.clearSecret,
      callbackUrl: input.callbackUrl,
      frontendCallbackUrl: input.frontendCallbackUrl,
      version: input.version
    }, { timeout: 30_000 }))
  } catch (error) {
    if (isBackendAdminApiError(error)) {
      if (error.status === 400) throw new KeycloakSettingsError('Проверьте настройки: callbacks должны быть на одном разрешённом origin. При смене issuer или client ID нужен новый secret либо удаление старого.')
      if (error.status === 401) {
        rejectAuthentication(getBackendAdminApiErrorAccessToken(error))
        throw new KeycloakSettingsError('Сессия завершена. Войдите снова.')
      }
      if (error.status === 403) throw new KeycloakSettingsError('Нужна действующая сессия владельца.')
      if (error.status === 409) throw new KeycloakSettingsError('Настройки изменены другим запросом. Обновите страницу перед сохранением.')
      if (error.status >= 500) throw new KeycloakSettingsError('Не удалось сохранить настройки. Проверьте issuer, доступность Keycloak и ключ шифрования сервера; обновите данные перед повтором.')
      if (error.status === 429) throw new KeycloakSettingsError('Слишком много запросов. Попробуйте позже.')
    }
    throw toApplicationDefect('keycloak-settings.save', error)
  }
}
