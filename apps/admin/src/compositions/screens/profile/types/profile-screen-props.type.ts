import type { ComponentPropsWithoutRef } from 'react'

/**
 * Экран не принимает предметные данные извне и получает их через публичный доменный хук.
 */
type ProfileScreenParams = object

/**
 * Допустимые атрибуты корневого раздела без управляемого экраном содержимого.
 */
type RootAttrs = Omit<ComponentPropsWithoutRef<'section'>, 'children'>

/**
 * Свойства экрана текущего администратора.
 */
export type ProfileScreenProps = RootAttrs & ProfileScreenParams
