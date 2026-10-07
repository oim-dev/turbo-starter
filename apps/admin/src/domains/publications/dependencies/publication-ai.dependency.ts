/**
 * Возможности AI source, необходимые доменному редактору.
 */
export type PublicationAiDependency = {
  /** Преобразует plain text по адаптированному редакционному действию. */
  transformText: (
    input: PublicationAiDependencyInput,
    signal?: AbortSignal
  ) => Promise<string>
}

/**
 * Source-neutral вход AI dependency.
 */
export type PublicationAiDependencyInput = {
  /** Поддерживаемое source действие. */
  action: 'rewrite' | 'shorten' | 'expand'
  /** Ограниченный контекст полного документа. */
  context?: string
  /** Текст selection или всего документа. */
  selectedText: string
  /** Заголовок публикации. */
  title?: string
}
