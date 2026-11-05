import type { TablerIcon } from '@tabler/icons-react'

/**
 * Пункт навигации, предоставляемый владельцем layout.
 */
export type AdminNavigationItem = {
  /**
   * Адрес страницы или ветки маршрутов.
   */
  to: string
  /**
   * Видимое и доступное название пункта.
   */
  label: string
  /**
   * Иконка для полной и компактной навигации.
   */
  icon: TablerIcon
  /**
   * Активировать пункт только при точном совпадении адреса.
   */
  end?: boolean
}
