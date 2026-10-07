import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clearAdminRestApiCsrfToken,
  getAdminRestApiCsrfToken,
  setAdminRestApiCsrfToken
} from 'infra/admin-rest-api'
import { logoutAuthSession, resolveAuthSession } from './auth.service'

/**
 * Создаёт успешный JSON-ответ для transport-level тестов auth-домена.
 */
const createJsonResponse = (data: unknown): Response => {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status: 200
  })
}

test('resolves a session before storing its CSRF token', async (context) => {
  const originalFetch = globalThis.fetch
  const responses = [
    createJsonResponse({ user: { fullName: 'Иван Иванов' } }),
    createJsonResponse({ csrfToken: 'csrf-token' })
  ]
  const calls: Array<{ method: string; url: string }> = []

  globalThis.fetch = async (input, init) => {
    calls.push({ method: init?.method ?? 'GET', url: String(input) })

    const response = responses.shift()

    if (!response) {
      throw new Error('Unexpected auth request')
    }

    return response
  }
  context.after(() => {
    globalThis.fetch = originalFetch
    clearAdminRestApiCsrfToken()
  })

  const session = await resolveAuthSession(new AbortController().signal)

  assert.deepEqual(session, { displayName: 'Иван Иванов' })
  assert.equal(getAdminRestApiCsrfToken(), 'csrf-token')
  assert.deepEqual(calls, [
    { method: 'GET', url: '/api/auth/session' },
    { method: 'GET', url: '/api/auth/csrf' }
  ])
})

test('clears stale CSRF state for an anonymous session', async (context) => {
  const originalFetch = globalThis.fetch
  setAdminRestApiCsrfToken('stale-token')
  globalThis.fetch = async () => createJsonResponse(null)
  context.after(() => {
    globalThis.fetch = originalFetch
    clearAdminRestApiCsrfToken()
  })

  const session = await resolveAuthSession(new AbortController().signal)

  assert.equal(session, null)
  assert.equal(getAdminRestApiCsrfToken(), null)
})

test('rejects malformed session data without requesting CSRF', async (context) => {
  const originalFetch = globalThis.fetch
  let requestCount = 0

  globalThis.fetch = async () => {
    requestCount += 1
    return createJsonResponse({ user: { fullName: '' } })
  }
  context.after(() => {
    globalThis.fetch = originalFetch
    clearAdminRestApiCsrfToken()
  })

  await assert.rejects(resolveAuthSession(new AbortController().signal), TypeError)
  assert.equal(requestCount, 1)
  assert.equal(getAdminRestApiCsrfToken(), null)
})

test('clears CSRF state after a successful logout', async (context) => {
  const originalFetch = globalThis.fetch
  setAdminRestApiCsrfToken('csrf-token')
  globalThis.fetch = async () => createJsonResponse({ redirectUrl: 'https://idp.example/logout' })
  context.after(() => {
    globalThis.fetch = originalFetch
    clearAdminRestApiCsrfToken()
  })

  const redirectUrl = await logoutAuthSession(new AbortController().signal)

  assert.equal(redirectUrl, 'https://idp.example/logout')
  assert.equal(getAdminRestApiCsrfToken(), null)
})
