import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

import { uploadPresignedForm } from 'infra/presigned-upload'
import { createUploadPublicationImage } from './upload-publication-image.service'

const STORAGE_URL = 'https://storage.example.test/upload'
const ARTIFACT_ID = '4feaa9ab-86fc-4afe-80f7-c828fd8e8567'
const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('publication image upload', () => {
  it('завершает artifact только после presigned FormData POST', async () => {
    const calls: string[] = []
    const progressItems: number[] = []
    const completeUpload = vi.fn(async () => {
      calls.push('complete')
      return {
        height: 600,
        id: ARTIFACT_ID,
        mimeType: 'image/png',
        url: 'https://cdn.example.test/image.png',
        width: 800
      }
    })
    server.use(
      http.post(STORAGE_URL, async ({ request }) => {
        calls.push('upload')
        const body = await request.formData()

        expect(body.get('key')).toBe('publications/image.png')
        expect(body.get('file')).toBeInstanceOf(File)
        return new HttpResponse(null, { status: 204 })
      })
    )
    const uploadImage = createUploadPublicationImage({
      completeUpload,
      createUploadIntent: async () => {
        calls.push('intent')
        return {
          artifactId: ARTIFACT_ID,
          fields: { key: 'publications/image.png' },
          url: STORAGE_URL
        }
      },
      uploadFile: async (intent, file, signal, onProgress) => {
        await uploadPresignedForm({
          fields: intent.fields,
          file,
          signal,
          url: intent.url
        })
        onProgress?.(50)
      }
    })

    const artifact = await uploadImage(
      new File(['image'], 'image.png', { type: 'image/png' }),
      { onProgress: progress => progressItems.push(progress) }
    )

    expect(calls).toEqual(['intent', 'upload', 'complete'])
    expect(progressItems).toEqual([2, 5, 45, 90, 100])
    expect(artifact.id).toBe(ARTIFACT_ID)
  })

  it('не вызывает complete после отклонённого storage upload', async () => {
    const completeUpload = vi.fn(async () => {
      throw new Error('complete must not be called')
    })
    server.use(
      http.post(STORAGE_URL, () => new HttpResponse(null, { status: 500 }))
    )
    const uploadImage = createUploadPublicationImage({
      completeUpload,
      createUploadIntent: async () => ({
        artifactId: ARTIFACT_ID,
        fields: { key: 'publications/image.png' },
        url: STORAGE_URL
      }),
      uploadFile: async (intent, file, signal) => {
        await uploadPresignedForm({
          fields: intent.fields,
          file,
          signal,
          url: intent.url
        })
      }
    })

    await expect(
      uploadImage(new File(['image'], 'image.png', { type: 'image/png' }))
    ).rejects.toMatchObject({ code: 'INVALID_UPLOAD' })
    expect(completeUpload).not.toHaveBeenCalled()
  })
})
