let accessToken: string | null = null

/**
 * Возвращает непрозрачный Bearer-токен из памяти текущего JavaScript runtime.
 */
export const getBackendAdminApiAccessToken = (): string | null => accessToken

/**
 * Устанавливает непустой Bearer-токен без пробельных символов в памяти клиента.
 */
export const setBackendAdminApiAccessToken = (nextAccessToken: string): void => {
  if (nextAccessToken.length === 0 || /\s/.test(nextAccessToken)) {
    throw new TypeError('Access token must be non-empty and contain no whitespace')
  }

  accessToken = nextAccessToken
}

/**
 * Идемпотентно удаляет Bearer-токен из памяти клиента.
 */
export const clearBackendAdminApiAccessToken = (): void => {
  accessToken = null
}
