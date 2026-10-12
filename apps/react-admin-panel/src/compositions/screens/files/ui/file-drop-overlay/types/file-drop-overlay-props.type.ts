import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры компонента FileDropOverlay.
 */
export type FileDropOverlayParams = {
  /**
   * Разрешено ли пользователю загружать файлы.
   */
  canUpload: boolean
  /**
   * Название документа для новой версии; иначе новые файлы.
   */
  targetTitle?: string
}

/**
 * Атрибуты корневого элемента компонента.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>

/**
 * Свойства компонента FileDropOverlay.
 */
export type FileDropOverlayProps = RootAttrs & FileDropOverlayParams
