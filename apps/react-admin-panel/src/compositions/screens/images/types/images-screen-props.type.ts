import type { ComponentPropsWithoutRef } from 'react'

/**
 * Атрибуты экрана; данные принадлежат публичным hooks домена images.
 */
export type ImagesScreenProps = Omit<ComponentPropsWithoutRef<'section'>, 'children'>
