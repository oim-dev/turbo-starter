import { describe, expect, it } from 'vitest'

import { AdminRestApiError } from 'infra/admin-rest-api'
import { mapPublicationSourceError } from './publication.error'

describe('publication source errors', () => {
  it('преобразует optimistic 409 в VERSION_CONFLICT без transport payload', () => {
    const sourceError = new AdminRestApiError(
      new Response(null, { status: 409, statusText: 'Conflict' }),
      { method: 'PATCH', path: '/api/publications/publication-id' },
      undefined,
      {
        code: 'VERSION_CONFLICT',
        message: 'Source details',
        statusCode: 409
      }
    )

    const error = mapPublicationSourceError(sourceError)

    expect(error).toMatchObject({
      code: 'VERSION_CONFLICT',
      message: 'Публикация была изменена в другой сессии.'
    })
  })
})
