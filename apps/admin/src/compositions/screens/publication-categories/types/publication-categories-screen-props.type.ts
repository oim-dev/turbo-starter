import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры экрана PublicationCategories.
 */
export type PublicationCategoriesScreenParams = object

/** Атрибуты корневого элемента экрана. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'main'>, 'children'>

/**
 * Props экрана PublicationCategories.
 */
export type PublicationCategoriesScreenProps = RootAttrs & PublicationCategoriesScreenParams
