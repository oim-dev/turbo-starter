import { createTheme, DEFAULT_THEME } from '@mantine/core'

/**
 * Нейтральная административная тема с системным шрифтом и синим акцентом Mantine.
 */
export const THEME = createTheme({
  primaryColor: 'brand',
  primaryShade: 7,
  autoContrast: true,
  defaultRadius: 'md',
  fontFamily: 'system-ui, sans-serif',
  fontSizes: {
    xs: '0.75rem',
    sm: '0.8125rem',
    md: '0.875rem',
    lg: '1rem',
    xl: '1.125rem'
  },
  headings: {
    fontFamily: 'system-ui, sans-serif',
    fontWeight: '700',
    sizes: {
      h1: { fontSize: '1.75rem', lineHeight: '1.25' },
      h2: { fontSize: '1.375rem', lineHeight: '1.35' },
      h3: { fontSize: '1.125rem', lineHeight: '1.4' }
    }
  },
  colors: {
    brand: DEFAULT_THEME.colors.blue,
    gray: [
      '#f8f8f8',
      '#f1f1f1',
      '#e6e6e6',
      '#d5d5d5',
      '#b8b8b8',
      '#969696',
      '#707070',
      '#555555',
      '#383838',
      '#242424'
    ],
    dark: [
      '#ededed',
      '#c7c7c7',
      '#a8a8a8',
      '#7b7b7b',
      '#535353',
      '#3a3a3a',
      '#2b2b2b',
      '#222222',
      '#181818',
      '#111111'
    ]
  }
})
