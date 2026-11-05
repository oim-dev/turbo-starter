import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'

/**
 * Монтирует приложение в HTML-точке входа.
 */
export const startApplication = (): void => {
  const rootElement = document.getElementById('root')

  if (rootElement === null) {
    throw new Error('Application root element is missing')
  }

  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>
  )
}
