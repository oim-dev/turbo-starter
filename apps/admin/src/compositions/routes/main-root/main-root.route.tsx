import { MainLayout } from 'compositions/layouts/main'

/**
 * Корневой route module кабинета.
 *
 * Используется для:
 *  - подключения MainLayout к авторизуемой route branch
 */
export const MainRootRoute = () => {
  return <MainLayout />
}
