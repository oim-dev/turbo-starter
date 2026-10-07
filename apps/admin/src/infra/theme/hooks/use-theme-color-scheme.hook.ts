import { useComputedColorScheme, useMantineColorScheme } from '@mantine/core'

/**
 * Элементы управления цветовой схемой приложения.
 */
type ThemeColorSchemeControls = {
  /** Используется ли тёмная цветовая схема. */
  isDark: boolean
  /** Переключает светлую и тёмную цветовые схемы. */
  toggleColorScheme: () => void
}

/**
 * Возвращает фактическую цветовую схему и действие для её переключения.
 */
export const useThemeColorScheme = (): ThemeColorSchemeControls => {
  const colorScheme = useComputedColorScheme('light', { getInitialValueInEffect: false })
  const { toggleColorScheme } = useMantineColorScheme()

  return {
    isDark: colorScheme === 'dark',
    toggleColorScheme
  }
}
