import { ColorSchemeScript } from '@mantine/core'
import type { Metadata } from 'next'
import type { JSX } from 'react'
import { THEME_COLOR_SCHEME } from 'ui/themes'
import { ThemeProvider } from 'ui/themes/client'

/**
 * Общие метаданные стартового приложения.
 */
export const metadata: Metadata = {
  title: {
    default: 'Стартовое приложение',
    template: '%s | Стартовое приложение'
  },
  description: 'Основа веб-приложения на Next.js, Mantine и Unit Architecture.'
}

/**
 * Подключает документ Next.js и общую тему маршрутов.
 *
 * Используется для:
 *  - согласованной инициализации страниц при SSR и гидратации
 */
const RootLayout = (props: LayoutProps<'/'>): JSX.Element => {
  const { children } = props

  return (
    <html data-mantine-color-scheme={THEME_COLOR_SCHEME} lang="ru">
      <head>
        <ColorSchemeScript defaultColorScheme={THEME_COLOR_SCHEME} forceColorScheme={THEME_COLOR_SCHEME} />
      </head>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}

export default RootLayout
