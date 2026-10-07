import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры экрана Publications.
 */
export type PublicationsScreenParams = object

/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'main'>, 'children'>

/**
 * Props экрана списка публикаций.
 */
export type PublicationsScreenProps = RootAttrs & PublicationsScreenParams
