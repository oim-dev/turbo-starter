import type { ApiCredential } from '../types/api-session.type'

/** Credential отправленного запроса; запись освобождается вместе с объектом запроса. */
export const requestCredentialMap = new WeakMap<object, ApiCredential>()
