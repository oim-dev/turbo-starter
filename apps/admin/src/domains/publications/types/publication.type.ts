import type { RichTextDocument } from '@biocad/rich-text'
import type { PublicationCategory } from 'domains/publication-categories'

/**
 * Допустимые состояния публикации.
 */
export const PUBLICATION_STATUSES = ['draft', 'published'] as const

/**
 * Состояние публикации в редакционном lifecycle.
 */
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number]

/**
 * Готовое изображение, связанное с публикацией.
 */
export type PublicationArtifact = {
  /** Стабильный UUID артефакта. */
  id: string
  /** Альтернативный текст изображения, если он задан в контексте обложки. */
  alt?: string
  /** Высота изображения в пикселях. */
  height: number | null
  /** MIME-тип готового файла. */
  mimeType: string | null
  /** Публичный delivery URL. */
  url: string | null
  /** Ширина изображения в пикселях. */
  width: number | null
}

/**
 * Краткая модель публикации для редакционного списка.
 */
export type PublicationSummary = {
  /** Категория материала. */
  category: PublicationCategory
  /** Обложка публикации. */
  cover: PublicationArtifact | null
  /** Время создания в ISO-формате. */
  createdAt: string
  /** Краткий анонс. */
  excerpt: string
  /** Стабильный UUID публикации. */
  id: string
  /** Время публикации в ISO-формате. */
  publishedAt: string | null
  /** URL slug. */
  slug: string
  /** Текущее редакционное состояние. */
  status: PublicationStatus
  /** Заголовок. */
  title: string
  /** Время последнего изменения в ISO-формате. */
  updatedAt: string
  /** Версия optimistic concurrency. */
  version: number
}

/**
 * Полная модель публикации для редактора.
 */
export type Publication = PublicationSummary & {
  /** Канонический versioned rich-text документ. */
  body: RichTextDocument
  /** Альтернативный текст обложки. */
  coverAlt: string
  /** Готовые артефакты, доступные rich-text node views. */
  mediaArtifacts: PublicationArtifact[]
}

/**
 * Результат загрузки редакционного списка.
 */
export type PublicationPage = {
  /** Публикации текущей выдачи. */
  items: PublicationSummary[]
  /** Номер текущей страницы. */
  page: number
  /** Размер текущей страницы. */
  pageSize: number
  /** Общее число публикаций по фильтрам. */
  total: number
}

/**
 * Фильтры редакционного списка.
 */
export type PublicationFilters = {
  /** UUID категории для серверной фильтрации. */
  categoryId: string | null
  /** Номер запрошенной страницы. */
  page: number
  /** Размер страницы. */
  pageSize: number
  /** Поиск по заголовку публикации. */
  search: string
  /** Ограничение по состоянию публикации. */
  status: PublicationStatus | null
}

/**
 * Редактируемые поля публикации до сохранения.
 */
export type PublicationDraft = {
  /** Канонический versioned rich-text документ. */
  body: RichTextDocument
  /** UUID выбранной категории. */
  categoryId: string
  /** Текущая обложка. */
  cover: PublicationArtifact | null
  /** Альтернативный текст обложки. */
  coverAlt: string
  /** Краткий анонс. */
  excerpt: string
  /** URL slug. */
  slug: string
  /** Заголовок. */
  title: string
}

/**
 * Действия AI-помощника редактора.
 */
export type PublicationAiAction = 'rewrite' | 'shorten' | 'expand' | 'tone'

/**
 * Вход AI-преобразования текста публикации.
 */
export type PublicationAiInput = {
  /** Редакторское действие. */
  action: PublicationAiAction
  /** Полный plain-text документ для контекста или обработки. */
  document: string
  /** Выделенный plain text, если редактор сделал выделение. */
  selection: string
  /** Заголовок публикации для контекста. */
  title: string
}
