/**
 * Согласует подпись главного действия с размером очереди.
 */
export const formatUploadAction = (count: number): string => {
  const plural = new Intl.PluralRules('ru-RU').select(count)
  const noun = plural === 'one' ? 'файл' : plural === 'few' ? 'файла' : 'файлов'
  return `Загрузить ${count} ${noun}`
}
