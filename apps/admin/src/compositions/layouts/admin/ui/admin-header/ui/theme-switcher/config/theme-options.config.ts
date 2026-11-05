import { IconDeviceDesktop, IconMoon, IconSun } from '@tabler/icons-react'

/** Отображаемые варианты единого механизма цветовой схемы. */
export const THEME_OPTIONS = [
  { value: 'light', label: 'Светлая', icon: IconSun },
  { value: 'dark', label: 'Тёмная', icon: IconMoon },
  { value: 'auto', label: 'Как в системе', icon: IconDeviceDesktop }
] as const
