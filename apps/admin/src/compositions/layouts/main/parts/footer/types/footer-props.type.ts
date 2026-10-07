import type { ComponentPropsWithoutRef } from 'react'

/**
 * Параметры модуля Footer.
 */
export type FooterParams = object

/** Атрибуты корневого элемента. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'footer'>, 'children'>

/**
 * Параметры нижней панели основного layout.
 */
export type FooterProps = RootAttrs & FooterParams
