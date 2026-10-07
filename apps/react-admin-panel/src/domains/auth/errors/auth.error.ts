/** Предусмотренные причины отказа или завершения административной сессии. */
export const AUTH_ERROR_CODE = {
  INVALID_CREDENTIALS: 'INVALID_CREDENTIALS',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  REQUEST_REJECTED: 'REQUEST_REJECTED',
  RATE_LIMITED: 'RATE_LIMITED',
  UNAVAILABLE: 'UNAVAILABLE',
  REFRESH_UNCERTAIN: 'REFRESH_UNCERTAIN',
  LOGOUT_INCOMPLETE: 'LOGOUT_INCOMPLETE',
  UNSUPPORTED_BROWSER: 'UNSUPPORTED_BROWSER',
  SUPERSEDED: 'SUPERSEDED'
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

/** Предусмотренные отказы восстановления общей cookie. */
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
