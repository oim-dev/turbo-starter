import { isArrayOf, isRecord, isString } from 'shared/value-predicates'
import type { AccessPermission, AccessRole, ManagedAccount, ManagedIdentity } from '../types/access.type'

/**
 * Проверяет и адаптирует список внешних привязок аккаунта.
 */
const mapIdentities = (payload: unknown): ManagedIdentity[] => {
  if (!Array.isArray(payload)) throw new Error('Invalid identities')
  return payload.map((entry: unknown) => {
    if (
      !isRecord(entry) || !['id', 'issuer', 'subject'].every((key) => Object.hasOwn(entry, key)) ||
      !isString(entry.id) || !isString(entry.issuer) || !isString(entry.subject)
    ) throw new Error('Invalid identity')
    return { id: entry.id, issuer: entry.issuer, subject: entry.subject }
  })
}

/**
 * Проверяет и адаптирует каталог permissions.
 */
export const mapPermissions = (payload: unknown): AccessPermission[] => {
  if (!Array.isArray(payload)) throw new Error('Invalid permissions')
  return payload.map((entry: unknown) => {
    if (!isRecord(entry) || !['key', 'name', 'system'].every((key) => Object.hasOwn(entry, key)) || !isString(entry.key) || !isString(entry.name) || typeof entry.system !== 'boolean') throw new Error('Invalid permission')
    return { key: entry.key, name: entry.name, system: entry.system }
  })
}
/**
 * Проверяет и адаптирует список ролей.
 */
export const mapRoles = (payload: unknown): AccessRole[] => {
  if (!Array.isArray(payload)) throw new Error('Invalid roles')
  return payload.map((entry: unknown) => {
    if (!isRecord(entry) || !['key', 'name', 'permissions', 'isBuiltin', 'version'].every((key) => Object.hasOwn(entry, key)) || !isString(entry.key) || !isString(entry.name) || !isArrayOf(entry.permissions, isString) || typeof entry.isBuiltin !== 'boolean' || typeof entry.version !== 'number') throw new Error('Invalid role')
    return { key: entry.key, name: entry.name, permissions: [...entry.permissions], isBuiltin: entry.isBuiltin, version: entry.version }
  })
}
/**
 * Проверяет и адаптирует список аккаунтов без credentials.
 */
export const mapAccounts = (payload: unknown): ManagedAccount[] => {
  if (!Array.isArray(payload)) throw new Error('Invalid accounts')
  return payload.map((entry: unknown) => {
    if (!isRecord(entry) || !['id', 'login', 'name', 'role', 'isActive', 'hasLocalPassword', 'version'].every((key) => Object.hasOwn(entry, key)) || !isString(entry.id) || !isString(entry.login) || !isString(entry.name) || !isString(entry.role) || typeof entry.isActive !== 'boolean' || typeof entry.hasLocalPassword !== 'boolean' || typeof entry.version !== 'number') throw new Error('Invalid account')
    if (!Object.hasOwn(entry, 'identities')) throw new Error('Missing identities')
    return { id: entry.id, login: entry.login, name: entry.name, role: entry.role, isActive: entry.isActive, hasLocalPassword: entry.hasLocalPassword, version: entry.version, identities: mapIdentities(entry.identities) }
  })
}
