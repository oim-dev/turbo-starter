import type { ComponentPropsWithoutRef } from 'react'

/**
 * Доступные названия переходов по страницам документов.
 */
const PAGINATION_LABELS = {
  first: 'Первая страница',
  previous: 'Предыдущая страница',
  next: 'Следующая страница',
  last: 'Последняя страница'
} as const

/**
 * Подписывает кнопки пагинации для скринридера.
 */
export const getPaginationControlProps = (control: keyof typeof PAGINATION_LABELS): ComponentPropsWithoutRef<'button'> => ({ 'aria-label': PAGINATION_LABELS[control] })
