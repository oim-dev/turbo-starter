import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/** Параметры компонента PageHeading. */
export type PageHeadingParams = {
  /** Основной заголовок. */
  title: string
  /** Пояснение под заголовком. */
  description?: string
  /** Короткая надпись над заголовком. */
  eyebrow?: string
  /** Дочернее содержимое компонента. */
  children?: ReactNode
}

/** Атрибуты корневого элемента компонента PageHeading. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'header'>, 'children' | 'title'>

/** Свойства компонента PageHeading. */
export type PageHeadingProps = RootAttrs & PageHeadingParams
