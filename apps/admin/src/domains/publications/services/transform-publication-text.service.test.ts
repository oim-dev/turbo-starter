import { describe, expect, it, vi } from 'vitest'

import { createTransformPublicationText } from './transform-publication-text.service'

describe('publication AI transform', () => {
  it('передаёт selection как target, а document как ограниченный context', async () => {
    const transformText = vi.fn(async () => 'Результат')
    const transform = createTransformPublicationText({ transformText })

    await transform({
      action: 'shorten',
      document: 'Полный текст публикации',
      selection: 'Выделенный текст',
      title: 'Заголовок'
    })

    expect(transformText).toHaveBeenCalledWith(
      {
        action: 'shorten',
        context: 'Полный текст публикации',
        selectedText: 'Выделенный текст',
        title: 'Заголовок'
      },
      undefined
    )
  })

  it('адаптирует tone к доступной source-команде с явной редакционной инструкцией', async () => {
    const transformText = vi.fn(async () => 'Результат')
    const transform = createTransformPublicationText({ transformText })

    await transform({
      action: 'tone',
      document: 'Полный текст публикации',
      selection: 'Полный текст публикации',
      title: ''
    })

    expect(transformText).toHaveBeenCalledWith(
      {
        action: 'rewrite',
        context: [
          'Перепиши текст в нейтральном профессиональном тоне для корпоративного медицинского сайта.',
          'Полный текст публикации'
        ].join('\n\n'),
        selectedText: 'Полный текст публикации',
        title: undefined
      },
      undefined
    )
  })
})
