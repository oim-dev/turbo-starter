/**
 * Категория публикаций, доступная другим доменным владельцам.
 */
export type PublicationCategory = Readonly<{
  /** Стабильный UUID категории. */
  id: string
  /** Отображаемое название категории. */
  name: string
  /** URL slug категории. */
  slug: string
}>

/**
 * Категория с редакционными метаданными для управления.
 */
export type AdminPublicationCategory = PublicationCategory & Readonly<{
  /** Время создания в ISO-формате. */
  createdAt: string
  /** Количество публикаций в категории. */
  publicationCount: number
  /** Время последнего изменения в ISO-формате. */
  updatedAt: string
  /** Версия optimistic concurrency. */
  version: number
}>

/**
 * Страница категорий публикаций.
 */
export type PublicationCategoryPage = Readonly<{
  /** Категории текущей страницы. */
  items: AdminPublicationCategory[]
  /** Номер текущей страницы. */
  page: number
  /** Размер страницы. */
  pageSize: number
  /** Общее количество категорий. */
  total: number
}>

/**
 * Параметры серверного списка категорий.
 */
export type PublicationCategoryFilters = Readonly<{
  /** Номер запрошенной страницы. */
  page: number
  /** Размер страницы. */
  pageSize: number
  /** Поиск по названию или slug. */
  search: string
}>

/**
 * Редактируемые поля категории.
 */
export type PublicationCategoryInput = Readonly<{
  /** Отображаемое название категории. */
  name: string
  /** URL slug категории. */
  slug: string
}>
