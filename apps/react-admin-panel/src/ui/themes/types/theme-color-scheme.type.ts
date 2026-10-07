import type { MantineColorScheme } from '@mantine/core'

/** Поддерживаемый выбор цветовой схемы, включая следование настройкам системы. */
export type ThemeColorScheme = MantineColorScheme

/** Публичное управление цветовой схемой приложения. */
export type ThemeColorSchemeControls = {
  /** Сохранённое предпочтение пользователя либо системный режим. */
  colorScheme: ThemeColorScheme
  /** Применяет и сохраняет выбранный режим. */
  setColorScheme: (colorScheme: ThemeColorScheme) => void
}
