/** Предусмотренные причины отказа или завершения административной сессии. */
export const AUTH_ERROR_CODE = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  REQUEST_REJECTED: 'REQUEST_REJECTED',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAVAILABLE: 'UNAVAILABLE',
  LOGOUT_INCOMPLETE: 'LOGOUT_INCOMPLETE',
  UNSUPPORTED_BROWSER: 'UNSUPPORTED_BROWSER',
  SUPERSEDED: 'SUPERSEDED',
  /**
   * Провайдер входа временно недоступен.
   */
  KEYCLOAK_UNAVAILABLE: 'KEYCLOAK_UNAVAILABLE',
  /**
   * Провайдер или политика допуска отклонили вход.
   */
  KEYCLOAK_DENIED: 'KEYCLOAK_DENIED',
  /**
   * Результат входа истёк, уже использован либо некорректен.
   */
  KEYCLOAK_INVALID: 'KEYCLOAK_INVALID',
  /**
   * Результат одноразового завершения неизвестен; требуется новый вход, не повтор обмена.
   */
  KEYCLOAK_UNCERTAIN: 'KEYCLOAK_UNCERTAIN'
} as const

/** Стабильный код ожидаемой ошибки авторизации. */
export type AuthErrorCode = (typeof AUTH_ERROR_CODE)[keyof typeof AUTH_ERROR_CODE]

/** Безопасная предметная ошибка без ответа сервера и учётных данных. */
export type AuthError<Code extends AuthErrorCode = AuthErrorCode> = Error & {
  /** Причина, которую может отобразить потребитель. */
  readonly code: Code
}

/** Предусмотренные отказы нового входа и подтверждения администратора. */
export type SignInError = AuthError<Exclude<AuthErrorCode, typeof AUTH_ERROR_CODE.LOGOUT_INCOMPLETE>>

/** Предусмотренные отказы проверки сохранённого JWT. */
export type RestoreSessionError = AuthError<Exclude<
  AuthErrorCode,
  typeof AUTH_ERROR_CODE.INVALID_CREDENTIALS | typeof AUTH_ERROR_CODE.LOGOUT_INCOMPLETE
>>

/** Предусмотренные отказы завершения сессии. */
export type LogoutError = AuthError<typeof AUTH_ERROR_CODE.LOGOUT_INCOMPLETE | typeof AUTH_ERROR_CODE.SUPERSEDED>

/** Полный канал ошибок GET профиля, используемый SWR. */
export type GetCurrentUserError = AuthError<
  typeof AUTH_ERROR_CODE.SESSION_EXPIRED |
  typeof AUTH_ERROR_CODE.SUPERSEDED |
  typeof AUTH_ERROR_CODE.RATE_LIMITED |
  typeof AUTH_ERROR_CODE.UNAVAILABLE
>

/**
 * Полный канал ошибок публичного списка методов входа.
 */
export type GetSignInMethodsError = AuthError<typeof AUTH_ERROR_CODE.UNAVAILABLE>

/**
 * Идентифицирует ошибки домена независимо от технических исключений клиента.
 */
class AuthenticationError extends Error implements AuthError {
  readonly name = 'AuthenticationError'
  readonly code: AuthErrorCode

  constructor(code: AuthErrorCode) {
    super(`auth:${code}`)
    this.code = code
  }
}

/**
 * Создаёт ожидаемый исход без сохранения чувствительной ошибки источника.
 */
export const createAuthError = (code: AuthErrorCode): AuthError => new AuthenticationError(code)

/**
 * Отличает ожидаемый исход авторизации от дефекта приложения.
 */
export const isAuthError = (error: unknown): error is AuthError => error instanceof AuthenticationError
