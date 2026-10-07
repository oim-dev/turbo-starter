import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры экрана {{name.pascalCase}}.
 */
export type {{name.pascalCase}}ScreenParams = object

/** Атрибуты корневого элемента экрана. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'main'>, 'children'>

/**
 * Props экрана {{name.pascalCase}}.
 */
export type {{name.pascalCase}}ScreenProps = RootAttrs & {{name.pascalCase}}ScreenParams
