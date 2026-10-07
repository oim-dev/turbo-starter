import assert from 'node:assert/strict'
import test from 'node:test'

import {
  clearAdminRestApiCsrfToken,
  setAdminRestApiCsrfToken
} from 'infra/admin-rest-api'
import type { AuthAction } from '../state/auth-state.reducer'
import {
  logoutAuthSessionLifecycle,
  startAuthSessionLifecycle
} from './auth-lifecycle.service'

/**
 * Передаёт управление завершившимся Promise callbacks текущего теста.
 */
const flushPromises = async (): Promise<void> => {
  await new Promise((resolve) => setTimeout(resolve, 0))
}

/**
 * Создаёт JSON-ответ для проверки auth lifecycle через реальный infra-клиент.
 */
const createJsonResponse = (data: unknown, status = 200): Response => {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status
  })
}

test('publishes the successful session resolution lifecycle', async (context) => {
  const originalFetch = globalThis.fetch
  const responses = [
    createJsonResponse({ user: { fullName: 'Иван Иванов' } }),
    createJsonResponse({ csrfToken: 'csrf-token' })
  ]
  const actions: AuthAction[] = []

  globalThis.fetch = async () => {
    const response = responses.shift()

    if (!response) {
      throw new Error('Unexpected auth request')
    }

    return response
  }

  const cleanup = startAuthSessionLifecycle((action) => {
    actions.push(action)
  })
  context.after(() => {
    cleanup()
    globalThis.fetch = originalFetch
  })

  await flushPromises()

  assert.deepEqual(actions, [
    { type: 'resolve-started' },
    { session: { displayName: 'Иван Иванов' }, type: 'resolve-succeeded' }
  ])
})

test('keeps 401 invalidation from becoming a resolution error', async (context) => {
  const originalFetch = globalThis.fetch
  const actions: AuthAction[] = []

  globalThis.fetch = async () => createJsonResponse({ message: 'Unauthorized' }, 401)

  const cleanup = startAuthSessionLifecycle((action) => {
    actions.push(action)
  })
  context.after(() => {
    cleanup()
    globalThis.fetch = originalFetch
  })

  await flushPromises()

  assert.deepEqual(actions, [
    { type: 'resolve-started' },
    { type: 'invalidated' }
  ])
})

test('ignores completion from a cleaned up lifecycle', async (context) => {
  const originalFetch = globalThis.fetch
  const actions: AuthAction[] = []

  globalThis.fetch = async (_input, init) => {
    return new Promise<Response>((_resolve, reject) => {
      const signal = init?.signal

      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }

      signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
    })
  }
  context.after(() => {
    globalThis.fetch = originalFetch
  })

  const cleanup = startAuthSessionLifecycle((action) => {
    actions.push(action)
  })
  cleanup()
  await flushPromises()

  assert.deepEqual(actions, [{ type: 'resolve-started' }])
})

test('supports the StrictMode setup-cleanup-setup sequence', async (context) => {
  const originalFetch = globalThis.fetch
  const actions: AuthAction[] = []
  let requestCount = 0

  globalThis.fetch = async (_input, init) => {
    requestCount += 1

    if (requestCount === 1) {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal

        if (signal?.aborted) {
          reject(new DOMException('Aborted', 'AbortError'))
          return
        }

        signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')), { once: true })
      })
    }

    return createJsonResponse(null)
  }
  context.after(() => {
    globalThis.fetch = originalFetch
  })

  const firstCleanup = startAuthSessionLifecycle((action) => {
    actions.push(action)
  })
  firstCleanup()
  const secondCleanup = startAuthSessionLifecycle((action) => {
    actions.push(action)
  })

  await flushPromises()
  secondCleanup()

  assert.deepEqual(actions, [
    { type: 'resolve-started' },
    { type: 'resolve-started' },
    { session: null, type: 'resolve-succeeded' }
  ])
})

test('invalidates local state when logout has an uncertain server result', async (context) => {
  const originalFetch = globalThis.fetch
  const actions: AuthAction[] = []
  setAdminRestApiCsrfToken('csrf-token')
  globalThis.fetch = async () => {
    throw new TypeError('Connection closed after sending the request')
  }
  context.after(() => {
    globalThis.fetch = originalFetch
    clearAdminRestApiCsrfToken()
  })

  const result = await logoutAuthSessionLifecycle((action) => {
    actions.push(action)
  }, new AbortController().signal)

  assert.deepEqual(result, { status: 'failed' })
  assert.deepEqual(actions, [{ type: 'invalidated' }])
})
