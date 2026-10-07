import type { ComponentPropsWithoutRef } from 'react'

/**
 * Атрибуты корневой секции списка публикаций.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Props редакционного списка публикаций.
 */
export type PublicationsListProps = RootAttrs
