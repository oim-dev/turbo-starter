import {
  createBrowserRouter,
  createRoutesFromElements,
  Navigate,
  Route
} from 'react-router-dom'

import { MainRootRoute } from 'compositions/routes/main-root'
import { MainRoute } from 'compositions/routes/main'
import { PublicationCreateRoute } from 'compositions/routes/publication-create'
import { PublicationCategoriesRoute } from 'compositions/routes/publication-categories'
import { PublicationEditRouteEntry } from 'compositions/routes/publication-edit'
import { PublicationsRoute } from 'compositions/routes/publications'
import { AuthLogin, AuthRoot, RequireAuth } from 'domains/auth/client'

/**
 * Связывает URL панели администрирования с composition modules.
 *
 * Используется для:
 *  - подключения route modules к React Router
 *  - перенаправления неизвестных URL на страницу входа
 */
const routes = createRoutesFromElements(
  <Route element={<AuthRoot />}>
    <Route element={<AuthLogin />} path="/login" />
    <Route element={<RequireAuth />}>
      <Route element={<MainRootRoute />} path="/">
        <Route index element={<MainRoute />} />
        <Route element={<PublicationsRoute />} path="publications" />
        <Route element={<PublicationCategoriesRoute />} path="publications/categories" />
        <Route element={<PublicationCreateRoute />} path="publications/new" />
        <Route element={<PublicationEditRouteEntry />} path="publications/:publicationId" />
      </Route>
    </Route>
    <Route element={<Navigate replace to="/login" />} path="*" />
  </Route>
)

/**
 * Единственный data router панели администрирования.
 */
export const appRouter = createBrowserRouter(routes)
