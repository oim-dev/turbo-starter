import { createTheme } from '@mantine/core'

/**
 * Нейтральная визуальная конфигурация стартового приложения.
 */
export const THEME = createTheme({
  primaryColor: 'blue',
  primaryShade: 8,
  defaultRadius: 'md',
  fontFamily: 'system-ui, sans-serif',
  headings: {
    fontFamily: 'system-ui, sans-serif',
    fontWeight: '650'
  }
})
