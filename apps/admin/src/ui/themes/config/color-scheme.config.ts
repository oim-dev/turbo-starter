import { localStorageColorSchemeManager } from '@mantine/core'

/**
 * Личная визуальная настройка браузера сохраняется независимо от административной сессии.
 */
export const COLOR_SCHEME_MANAGER = localStorageColorSchemeManager({ key: 'react-admin-panel-color-scheme' })
