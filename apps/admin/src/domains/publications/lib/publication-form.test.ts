import { describe, expect, it } from 'vitest'

import {
  createEmptyPublicationDraft,
  getPublicationPublishValidationIssues,
  isPublicationDraftDirty
} from './publication-form'

describe('publication form state', () => {
  it('остаётся чистым для эквивалентного канонического draft', () => {
    const savedDraft = createEmptyPublicationDraft()
    const currentDraft = createEmptyPublicationDraft()

    expect(isPublicationDraftDirty(currentDraft, savedDraft)).toBe(false)
  })

  it('становится dirty после изменения поля или rich-text документа', () => {
    const savedDraft = createEmptyPublicationDraft()
    const changedTitleDraft = { ...savedDraft, title: 'Новый материал' }
    const changedBodyDraft = {
      ...savedDraft,
      body: {
        doc: {
          content: [
            {
              content: [{ text: 'Текст', type: 'text' }],
              type: 'paragraph'
            }
          ],
          type: 'doc' as const
        },
        schemaVersion: 1 as const
      }
    }

    expect(isPublicationDraftDirty(changedTitleDraft, savedDraft)).toBe(true)
    expect(isPublicationDraftDirty(changedBodyDraft, savedDraft)).toBe(true)
  })

  it('объясняет все требования, которые блокируют публикацию', () => {
    const draft = createEmptyPublicationDraft()

    expect(getPublicationPublishValidationIssues(draft)).toEqual([
      'Укажите заголовок.',
      'Укажите slug.',
      'Выберите категорию.',
      'Заполните анонс.',
      'Загрузите обложку.',
      'Добавьте альтернативный текст обложки.',
      'Добавьте текст публикации.'
    ])
  })

  it('разрешает публикацию полностью заполненного draft', () => {
    const draft = {
      ...createEmptyPublicationDraft(),
      body: {
        doc: {
          content: [
            {
              content: [{ text: 'Текст публикации', type: 'text' }],
              type: 'paragraph'
            }
          ],
          type: 'doc' as const
        },
        schemaVersion: 1 as const
      },
      cover: {
        height: 640,
        id: '550e8400-e29b-41d4-a716-446655440000',
        mimeType: 'image/webp',
        url: 'https://example.com/cover.webp',
        width: 1200
      },
      coverAlt: 'Описание обложки',
      categoryId: '550e8400-e29b-41d4-a716-446655440001',
      excerpt: 'Краткий анонс',
      slug: 'publication-slug',
      title: 'Заголовок'
    }

    expect(getPublicationPublishValidationIssues(draft)).toEqual([])
  })
})
