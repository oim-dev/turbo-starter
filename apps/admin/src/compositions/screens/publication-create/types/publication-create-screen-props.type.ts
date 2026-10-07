import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры экрана PublicationCreate.
 */
export type PublicationCreateScreenParams = object

/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'main'>, 'children'>

/**
 * Props экрана создания публикации.
 */
export type PublicationCreateScreenProps = RootAttrs & PublicationCreateScreenParams
