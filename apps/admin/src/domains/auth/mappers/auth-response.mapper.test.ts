import assert from 'node:assert/strict'
import test from 'node:test'

import {
  mapAuthCsrfResponse,
  mapAuthLogoutResponse,
  mapAuthSessionResponse
} from './auth-response.mapper'

test('maps a valid BFF session to the domain model', () => {
  const session = mapAuthSessionResponse({
    permissions: ['pages.read'],
    user: { fullName: '  Иван Иванов  ' }
  })

  assert.deepEqual(session, { displayName: 'Иван Иванов' })
})

test('maps a null BFF session to an anonymous result', () => {
  assert.equal(mapAuthSessionResponse(null), null)
})

test('rejects malformed BFF session responses', () => {
  const malformedResponses: unknown[] = [
    undefined,
    {},
    { user: null },
    { user: {} },
    { user: { fullName: '' } }
  ]

  malformedResponses.forEach((response) => {
    assert.throws(() => mapAuthSessionResponse(response), TypeError)
  })
})

test('extracts CSRF token and logout redirect from valid responses', () => {
  assert.equal(mapAuthCsrfResponse({ csrfToken: 'csrf-token' }), 'csrf-token')
  assert.equal(mapAuthLogoutResponse({ redirectUrl: 'https://idp.example/logout' }), 'https://idp.example/logout')
})

test('rejects malformed CSRF and logout responses', () => {
  assert.throws(() => mapAuthCsrfResponse({ csrfToken: '' }), TypeError)
  assert.throws(() => mapAuthLogoutResponse({ redirectUrl: null }), TypeError)
  assert.throws(() => mapAuthLogoutResponse({ redirectUrl: 'javascript:alert(1)' }), TypeError)
})
