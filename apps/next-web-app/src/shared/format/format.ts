/**
 * Форматирует сумму в рублях, сохраняя значимые копейки.
 */
export const formatMoney = (amount: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency', currency: 'RUB', minimumFractionDigits: 0, maximumFractionDigits: 2
  }).format(amount)
}

/**
 * Показывает календарную дату одинаково на сервере и в браузере.
 */
export const formatDate = (date: string): string => {
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`)
  )
}
