import { useMantineColorScheme } from '@mantine/core'
import type { ThemeColorSchemeControls } from '../types/theme-color-scheme.type'

/**
 * Предоставляет единый источник цветовой схемы и её сохранения средствами Mantine.
 */
export const useThemeColorScheme = (): ThemeColorSchemeControls => {
  const { colorScheme, setColorScheme } = useMantineColorScheme()

  return { colorScheme, setColorScheme }
}
