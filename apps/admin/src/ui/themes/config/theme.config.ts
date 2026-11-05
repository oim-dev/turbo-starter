import { Badge, Button, createTheme, Input, Modal, Paper, Tabs } from '@mantine/core'
import styles from '../styles/components.module.css'

/**
 * Общая визуальная система административного рабочего пространства.
 */
export const THEME = createTheme({
  primaryColor: 'brand',
  primaryShade: { light: 6, dark: 5 },
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
    brand: [
      '#edf3ff',
      '#dbe7ff',
      '#bbd0ff',
      '#91b2ff',
      '#638dff',
      '#4270f5',
      '#315ce0',
      '#244bc5',
      '#203fa0',
      '#203880'
    ],
    gray: [
      '#f7f8fa',
      '#f0f2f5',
      '#e5e8ee',
      '#d2d8e2',
      '#a9b3c3',
      '#7e8a9e',
      '#5f6c80',
      '#445166',
      '#283549',
      '#182336'
    ],
    dark: ['#e3e9f2', '#c7d0df', '#a0adc0', '#76869e', '#46536a', '#303d52', '#222e41', '#192436', '#121c2d', '#0e1624']
  },
  components: {
    Button: Button.extend({ defaultProps: { radius: 'md' }, classNames: { root: styles.button } }),
    Paper: Paper.extend({ defaultProps: { radius: 'lg' } }),
    Input: Input.extend({ classNames: { input: styles.input } }),
    Badge: Badge.extend({ defaultProps: { tt: 'none', fw: 600, radius: 'sm', variant: 'light' } }),
    Modal: Modal.extend({ defaultProps: { centered: true, radius: 'lg', overlayProps: { blur: 3 } } }),
    Tabs: Tabs.extend({ classNames: { tab: styles.tab, list: styles.tabList } })
  }
})
