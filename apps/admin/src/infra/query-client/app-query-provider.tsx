import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

import type { AppQueryProviderProps } from './types/app-query-provider-props.type'

const queryClient = new QueryClient({
  defaultOptions: {
    mutations: {
      retry: false
    },
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 30_000
    }
  }
})

/**
 * Предоставляет единый cache lifecycle для server state панели.
 *
 * Используется для:
 *  - React Query hooks доменных модулей
 */
export const AppQueryProvider = (props: AppQueryProviderProps) => {
  const { children } = props

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
