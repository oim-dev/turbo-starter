/** Блокировка всех операций с refresh-cookie между вкладками одного origin. */
export const SESSION_LOCK = 'web-client-session'

/** Маркер предотвращает replay после потери ответа или закрытия вкладки. */
export const REFRESH_PENDING_KEY = 'web-client-refresh-pending'

/** Ключ несекретной ревизии сессии; не содержит токен или профиль. */
export const SESSION_SCOPE_KEY = 'web-client-session-scope'
