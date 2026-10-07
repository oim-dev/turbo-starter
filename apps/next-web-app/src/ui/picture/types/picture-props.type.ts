import type { ComponentPropsWithoutRef } from 'react'

/** Параметры компонента Picture. */
export type PictureParams = {
  /** Источник изображения либо отсутствие фотографии. */
  src: string | null
  /** Доступное описание. */
  alt: string
  /** Способ вписывания в область родителя. */
  fit?: 'cover' | 'contain'
  /** Загрузка сразу для главной фотографии. */
  isEager?: boolean
}

/** Атрибуты корневого элемента компонента Picture. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'span'>, 'children'>

/** Свойства компонента Picture. */
export type PictureProps = RootAttrs & PictureParams
