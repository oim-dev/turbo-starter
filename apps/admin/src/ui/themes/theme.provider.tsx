import { MantineProvider } from '@mantine/core'
import type { JSX } from 'react'
import { COLOR_SCHEME_MANAGER } from './config/color-scheme.config'
import { THEME } from './config/theme.config'
import type { ThemeProviderProps } from './types/theme-provider-props.type'
import './styles/index.css'

/**
 * Подключает визуальную тему Mantine.
 *
 * Используется для:
 *  - единого оформления экранов и всплывающих элементов
 *  - сохранения выбора темы и следования системной цветовой схеме
 */
export const ThemeProvider = (props: ThemeProviderProps): JSX.Element => {
  const { children } = props

  return (
    <MantineProvider theme={THEME} defaultColorScheme="auto" colorSchemeManager={COLOR_SCHEME_MANAGER}>
      {children}
    </MantineProvider>
  )
}
