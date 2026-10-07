let csrfToken: string | null = null

/**
 * Возвращает CSRF token текущей BFF-сессии.
 */
export const getAdminRestApiCsrfToken = (): string | null => {
  return csrfToken
}

/**
 * Сохраняет CSRF token текущей BFF-сессии только в памяти вкладки.
 */
export const setAdminRestApiCsrfToken = (token: string): void => {
  csrfToken = token
}

/**
 * Очищает CSRF token после завершения BFF-сессии.
 */
export const clearAdminRestApiCsrfToken = (): void => {
  csrfToken = null
}
