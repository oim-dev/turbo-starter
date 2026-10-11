import type { ComponentPropsWithoutRef } from 'react'

/**
 * Названия переходов пагинации для клавиатуры и скринридера.
 */
const PAGINATION_LABELS = {
  first: 'Первая страница',
  previous: 'Предыдущая страница',
  next: 'Следующая страница',
  last: 'Последняя страница'
} as const

/**
 * Добавляет доступное имя кнопке перехода без текстовой подписи.
 */
export const getPaginationControlProps = (
  control: keyof typeof PAGINATION_LABELS
): ComponentPropsWithoutRef<'button'> => ({ 'aria-label': PAGINATION_LABELS[control] })
