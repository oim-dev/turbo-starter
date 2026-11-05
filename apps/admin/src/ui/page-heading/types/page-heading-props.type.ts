import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/**
 * Параметры компонента PageHeading.
 */
export type PageHeadingParams = {
  /**
   * Основной заголовок страницы.
   */
  title: string
  /**
   * Короткое объяснение назначения страницы.
   */
  description: string
  /**
   * Название раздела над заголовком.
   */
  eyebrow: string
  /**
   * Основное действие страницы.
   */
  action?: ReactNode
}

/**
 * Атрибуты корневого элемента компонента PageHeading.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'header'>, 'children' | 'title'>

/**
 * Свойства компонента PageHeading.
 */
export type PageHeadingProps = RootAttrs & PageHeadingParams
