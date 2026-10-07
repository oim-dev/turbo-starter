import type { ComponentPropsWithoutRef } from 'react'

import type {
  AdminPublicationCategory,
  PublicationCategoryInput
} from '../../../types/publication-category.type'

/**
 * Параметры компонента PublicationCategoryForm.
 */
export type PublicationCategoryFormParams = {
  /** Категория для режима редактирования. */
  category: AdminPublicationCategory | null
  /** Признак выполняющегося сохранения. */
  isPending: boolean
  /** Закрывает форму без сохранения. */
  onCancel: () => void
  /** Сохраняет проверенные поля категории. */
  onSubmit: (input: PublicationCategoryInput) => Promise<void>
}

/** Атрибуты корневого элемента компонента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'form'>, 'children' | 'onSubmit'>

/**
 * Props компонента PublicationCategoryForm.
 */
export type PublicationCategoryFormProps = RootAttrs & PublicationCategoryFormParams
