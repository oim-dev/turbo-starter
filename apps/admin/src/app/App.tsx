import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from 'ui/themes'
import { appRouter } from './router/app-router'

/**
 * Подключает публичные провайдеры и маршрутизатор приложения.
 *
 * Используется для:
 *  - запуска дерева URL приложения
 */
export const App = () => {
  return (
    <ThemeProvider>
      <RouterProvider router={appRouter} />
    </ThemeProvider>
  )
}
