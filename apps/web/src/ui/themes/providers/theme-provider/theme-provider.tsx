import { MantineProvider } from '@mantine/core'
import type { JSX } from 'react'
import { THEME_COLOR_SCHEME } from '../../config/color-scheme.constant'
import { THEME } from '../../config/theme.config'
import type { ThemeProviderProps } from './types/theme-provider-props.type'
import '../../styles/index.css'

/**
 * Подключает общую тему Mantine с единой цветовой схемой для SSR и браузера.
 *
 * Используется для:
 *  - применения визуальных настроек ко всем страницам приложения
 */
export const ThemeProvider = (props: ThemeProviderProps): JSX.Element => {
  const { children } = props

  return (
    <MantineProvider defaultColorScheme={THEME_COLOR_SCHEME} forceColorScheme={THEME_COLOR_SCHEME} theme={THEME}>
      {children}
    </MantineProvider>
  )
}
