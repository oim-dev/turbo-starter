import type { ComponentPropsWithoutRef, ReactNode } from 'react'

/**
 * Параметры компонента {{name.pascalCase}}.
 */
export type {{name.pascalCase}}Params = {
  /**
   * Дочернее содержимое компонента.
   */
  children?: ReactNode
}

/**
 * Атрибуты корневого элемента компонента.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>

/**
 * Свойства компонента {{name.pascalCase}}.
 */
export type {{name.pascalCase}}Props = RootAttrs & {{name.pascalCase}}Params
