import type { ComponentPropsWithoutRef } from 'react'

/** Навигационные действия локального сайдбара. */
export type AdminSidebarParams = {
  /** Показывает компактную настольную навигацию с иконками. */
  isCompact: boolean
  /** Завершает выбор раздела и закрывает мобильное меню. */
  onNavigate: () => void
  /** Переключает ширину настольного сайдбара. */
  onToggleCompact?: () => void
  /** Закрывает мобильную выдвижную панель. */
  onClose?: () => void
}

/** Атрибуты содержимого AppShell.Navbar. */
type RootAttrs = Omit<ComponentPropsWithoutRef<'div'>, 'children'>

/** Свойства сайдбара административного layout. */
export type AdminSidebarProps = RootAttrs & AdminSidebarParams
