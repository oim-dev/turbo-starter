import assert from 'node:assert/strict'
import test from 'node:test'

import { authStateReducer, INITIAL_AUTH_STATE } from './auth-state.reducer'

test('transitions from unresolved to resolving', () => {
  assert.deepEqual(authStateReducer(INITIAL_AUTH_STATE, { type: 'resolve-started' }), { status: 'resolving' })
})

test('stores a resolved authenticated session', () => {
  const session = { displayName: 'Иван Иванов' }
  const state = authStateReducer({ status: 'resolving' }, { session, type: 'resolve-succeeded' })

  assert.deepEqual(state, { session, status: 'authenticated' })
})

test('maps an empty session and invalidation to anonymous state', () => {
  assert.deepEqual(
    authStateReducer({ status: 'resolving' }, { session: null, type: 'resolve-succeeded' }),
    { status: 'anonymous' }
  )
  assert.deepEqual(authStateReducer({ status: 'authenticated', session: { displayName: 'Администратор' } }, {
    type: 'invalidated'
  }), { status: 'anonymous' })
})

test('maps a failed resolution to retryable error state', () => {
  assert.deepEqual(authStateReducer({ status: 'resolving' }, { type: 'resolve-failed' }), { status: 'error' })
})
