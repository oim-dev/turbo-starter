import { RouterProvider } from 'react-router-dom'
import { AuthProvider } from 'domains/auth'
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
      <AuthProvider>
        <RouterProvider router={appRouter} />
      </AuthProvider>
    </ThemeProvider>
  )
}
