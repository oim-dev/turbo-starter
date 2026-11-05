/**
 * Исключает только null и undefined, сохраняя валидные falsy-значения.
 */
export const isDefined = <T>(value: T | null | undefined): value is T => value != null

/**
 * Проверяет отсутствие значения.
 */
export const isNotDefined = <T>(value: T | null | undefined): value is null | undefined => value == null

/**
 * Считает null, undefined и массив без элементов пустым списком.
 */
export const isEmptyArray = (value: readonly unknown[] | null | undefined): boolean => {
  return !Array.isArray(value) || value.length === 0
}

/**
 * Сужает массив до непустого кортежа.
 */
export const isNonEmptyArray = <T>(value: readonly T[] | null | undefined): value is readonly [T, ...T[]] => {
  return Array.isArray(value) && value.length > 0
}

/**
 * Проверяет вхождение внешнего значения в набор допустимых литералов.
 */
export const isOneOf = <T extends readonly unknown[]>(value: unknown, values: T): value is T[number] => {
  return values.some((item) => item === value)
}

/**
 * Проверяет объект с именованными полями на границе внешних данных.
 */
export const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Проверяет собственное поле, исключая значения из прототипа.
 */
export const hasOwn = <K extends PropertyKey>(value: object, key: K): value is Record<K, unknown> => {
  return Object.prototype.hasOwnProperty.call(value, key)
}
