import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры компонента PublicationCategoriesManager.
 */
export type PublicationCategoriesManagerParams = object

/** Атрибуты корневого элемента компонента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Props компонента PublicationCategoriesManager.
 */
export type PublicationCategoriesManagerProps = RootAttrs & PublicationCategoriesManagerParams
