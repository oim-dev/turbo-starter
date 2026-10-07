import assert from 'node:assert/strict'
import test from 'node:test'

import { getAuthReturnTo } from './get-auth-return-to'

test('returns a normalized internal route', () => {
  const search = new URLSearchParams({ returnTo: '/projects?page=2#active' })

  assert.equal(getAuthReturnTo(`?${search.toString()}`), '/projects?page=2#active')
})

test('falls back to root for missing and external routes', () => {
  const unsafeRoutes = [
    '',
    'https://example.com',
    '//example.com/path',
    '/\\example.com/path',
    '/safe/..//example.com/path'
  ]

  unsafeRoutes.forEach((returnTo) => {
    const search = new URLSearchParams({ returnTo })
    assert.equal(getAuthReturnTo(`?${search.toString()}`), '/')
  })

  assert.equal(getAuthReturnTo(''), '/')
})
