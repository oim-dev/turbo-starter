import dayjs from 'dayjs'
import utc from 'dayjs/plugin/utc'

dayjs.extend(utc)

/**
 * Представляет проверенную дату профиля в явно указанном часовом поясе UTC.
 */
export const formatProfileTimestamp = (timestamp: string): string => dayjs.utc(timestamp).format('DD.MM.YYYY HH:mm [UTC]')
