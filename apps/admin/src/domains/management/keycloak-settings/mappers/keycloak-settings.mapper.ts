import { hasOwn, isNumber, isRecord, isString } from 'shared/value-predicates'
import type { KeycloakSettings } from '../types/keycloak-settings.type'

/**
 * Проверяет безопасную конфигурацию провайдера; TTL административной сессии не редактируется.
 */
export const mapKeycloakSettings = (payload: unknown): KeycloakSettings => {
  if (
    !isRecord(payload) ||
    !hasOwn(payload, 'enabled') || typeof payload.enabled !== 'boolean' ||
    !hasOwn(payload, 'issuer') || !isString(payload.issuer) ||
    !hasOwn(payload, 'clientId') || !isString(payload.clientId) ||
    !hasOwn(payload, 'callbackUrl') || !isString(payload.callbackUrl) ||
    !hasOwn(payload, 'frontendCallbackUrl') || !isString(payload.frontendCallbackUrl) ||
    !hasOwn(payload, 'version') || !isNumber(payload.version) ||
    !hasOwn(payload, 'hasSecret') || typeof payload.hasSecret !== 'boolean' ||
    !hasOwn(payload, 'canStoreSecret') || typeof payload.canStoreSecret !== 'boolean'
  ) {
    throw new Error('Invalid Keycloak settings')
  }

  return {
    enabled: payload.enabled,
    issuer: payload.issuer,
    clientId: payload.clientId,
    callbackUrl: payload.callbackUrl,
    frontendCallbackUrl: payload.frontendCallbackUrl,
    version: payload.version,
    hasSecret: payload.hasSecret,
    canStoreSecret: payload.canStoreSecret
  }
}
