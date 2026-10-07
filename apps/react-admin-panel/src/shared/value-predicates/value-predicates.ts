/**
 * Исключает только null и undefined из типа значения.
 */
export const isDefined = <T>(value: T | null | undefined): value is T => value != null

/**
 * Проверяет, что значение отсутствует как null или undefined.
 */
export const isNotDefined = <T>(value: T | null | undefined): value is null | undefined => value == null

/**
 * Сужает unknown-значение до string.
 */
export const isString = (value: unknown): value is string => typeof value === 'string'

/**
 * Сужает unknown-значение до конечного number.
 */
export const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

/**
 * Сужает unknown-значение до boolean.
 */
export const isBoolean = (value: unknown): value is boolean => typeof value === 'boolean'

/**
 * Проверяет, что значение является строкой с непустым содержимым.
 */
export const isNonEmptyString = (value: unknown): value is string => {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Проверяет, что значение является массивом без проверки элементов.
 */
export const isArray = (value: unknown): value is unknown[] => Array.isArray(value)

/**
 * Проверяет массив и каждый его элемент через переданный guard.
 */
export const isArrayOf = <T>(value: unknown, isItem: (item: unknown) => item is T): value is T[] => {
  return Array.isArray(value) && value.every(isItem)
}

/**
 * Проверяет, что массив отсутствует или не содержит элементов.
 */
export const isEmptyArray = (value: readonly unknown[] | null | undefined): boolean => {
  return !Array.isArray(value) || value.length === 0
}

/**
 * Проверяет, что массив существует и содержит хотя бы один элемент.
 */
export const isNonEmptyArray = <T>(
  value: readonly T[] | null | undefined
): value is readonly [T, ...T[]] => {
  return Array.isArray(value) && value.length > 0
}

/**
 * Проверяет, что unknown-значение является объектом-записью.
 */
export const isRecord = (value: unknown): value is Record<PropertyKey, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Проверяет наличие собственного свойства объекта.
 */
export const hasOwn = <K extends PropertyKey>(value: object, key: K): value is Record<K, unknown> => {
  return Object.prototype.hasOwnProperty.call(value, key)
}

/**
 * Проверяет, что значение входит в список допустимых литералов.
 */
export const isOneOf = <T extends readonly unknown[]>(value: unknown, values: T): value is T[number] => {
  return values.some((item) => item === value)
}
