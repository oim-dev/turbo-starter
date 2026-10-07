import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры экрана Main.
 */
export type MainScreenParams = object

/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'main'>, 'children'>

/**
 * Параметры стартового экрана панели администрирования.
 */
export type MainScreenProps = RootAttrs & MainScreenParams
