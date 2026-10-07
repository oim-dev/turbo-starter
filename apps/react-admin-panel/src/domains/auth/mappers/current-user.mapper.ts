import { hasOwn, isNonEmptyString, isOneOf, isRecord } from 'shared/value-predicates'
import { AUTH_ERROR_CODE, createAuthError } from '../errors/auth.error'
import { ADMIN_ROLE } from '../types/admin-role.type'
import type { CurrentUser } from '../types/current-user.type'

/**
 * Отделяет подтверждённого администратора от DTO профиля и технических полей.
 */
export const mapCurrentUser = (payload: unknown): CurrentUser => {
  if (
    !isRecord(payload) ||
    !hasOwn(payload, 'id') || !isNonEmptyString(payload.id) ||
    !hasOwn(payload, 'login') || !isNonEmptyString(payload.login) ||
    !hasOwn(payload, 'isActive') || typeof payload.isActive !== 'boolean' ||
    !hasOwn(payload, 'role') || !isOneOf(payload.role, Object.values(ADMIN_ROLE)) ||
    !hasOwn(payload, 'createdAt') || !isNonEmptyString(payload.createdAt) ||
    !Number.isFinite(Date.parse(payload.createdAt)) ||
    !hasOwn(payload, 'updatedAt') || !isNonEmptyString(payload.updatedAt) ||
    !Number.isFinite(Date.parse(payload.updatedAt))
  ) {
    throw createAuthError(AUTH_ERROR_CODE.UNAVAILABLE)
  }

  if (!payload.isActive) {
    throw createAuthError(AUTH_ERROR_CODE.SESSION_EXPIRED)
  }

  return {
    id: payload.id,
    login: payload.login,
    role: payload.role,
    isActive: payload.isActive,
    createdAt: payload.createdAt,
    updatedAt: payload.updatedAt
  }
}
