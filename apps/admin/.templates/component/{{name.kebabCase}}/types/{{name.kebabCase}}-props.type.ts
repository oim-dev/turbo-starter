import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры компонента {{name.pascalCase}}.
 */
export type {{name.pascalCase}}Params = object

/** Атрибуты корневого элемента компонента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Props компонента {{name.pascalCase}}.
 */
export type {{name.pascalCase}}Props = RootAttrs & {{name.pascalCase}}Params
