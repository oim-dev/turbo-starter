import { MantineProvider } from '@mantine/core'

import { theme } from './config/theme.config'
import type { ThemeProviderProps } from './types/theme-provider-props.type'

/**
 * Подключает Mantine theme ко всему приложению.
 *
 * Используется для:
 *  - предоставления Mantine context
 *  - применения общей визуальной конфигурации
 */
export const ThemeProvider = (props: ThemeProviderProps) => {
  const { children } = props

  return (
    <MantineProvider defaultColorScheme="auto" theme={theme}>
      {children}
    </MantineProvider>
  )
}
