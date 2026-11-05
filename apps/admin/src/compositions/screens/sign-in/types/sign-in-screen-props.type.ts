import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры экрана входа.
 */
type SignInScreenParams = object

/**
 * Атрибуты корневого элемента экрана входа.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'main'>, 'children'>

/**
 * Свойства экрана входа администратора.
 */
export type SignInScreenProps = RootAttrs & SignInScreenParams
