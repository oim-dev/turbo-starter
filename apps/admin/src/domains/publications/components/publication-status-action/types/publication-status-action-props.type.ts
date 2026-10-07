import type { PublicationSummary } from '../../../types/publication.type'

/**
 * Props компонента PublicationStatusAction.
 */
export type PublicationStatusActionProps = {
  /** Признак pending для конкретной публикации. */
  isPending: boolean
  /** Признак любой выполняющейся status mutation. */
  isMutationPending: boolean
  /** Вариант размещения действия. */
  placement: 'primary' | 'menu'
  /** Публикация, статус которой изменяется. */
  publication: PublicationSummary
  /** Запускает изменение статуса опубликованной публикации. */
  onChange: (publication: PublicationSummary) => void
}
