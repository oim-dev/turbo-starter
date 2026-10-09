import 'server-only'
import { createApiClient } from '@oim/client-rest-api-sdk/create-api-client'
import { HttpClient } from '@oim/client-rest-api-sdk/http-client'

// Публичный транспорт не получает сессию запроса и не разделяет состояние browser-клиента.
const httpClient = new HttpClient({
  baseUrl: (
    process.env.CLIENT_API_INTERNAL_URL ?? process.env.NEXT_PUBLIC_CLIENT_API_URL ?? 'http://localhost:3001'
  ).replace(/\/$/, ''),
  credentials: 'omit',
  cache: 'no-store',
  timeout: 10_000
})

/** Публичный серверный клиент; текущий API не предоставляет независимых от авторизации операций. */
export const publicClientApi = createApiClient(httpClient, {})
