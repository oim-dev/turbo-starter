import { RouterProvider } from 'react-router-dom'

import { AppQueryProvider } from 'infra/query-client'
import { ThemeProvider } from 'infra/theme'
import { appRouter } from './app-router'

/**
 * Корневая композиция панели администрирования.
 *
 * Используется для:
 *  - подключения Mantine theme
 *  - запуска React Router и React Query
 */
export const App = () => {
  return (
    <ThemeProvider>
      <AppQueryProvider>
        <RouterProvider router={appRouter} />
      </AppQueryProvider>
    </ThemeProvider>
  )
}
