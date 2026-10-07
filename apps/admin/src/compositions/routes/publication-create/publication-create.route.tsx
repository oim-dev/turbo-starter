import { PublicationCreateScreen } from 'compositions/screens/publication-create'

/**
 * Route создания публикации.
 *
 * Используется для:
 *  - подключения PublicationCreateScreen к защищённой route branch
 */
export const PublicationCreateRoute = () => {
  return <PublicationCreateScreen />
}
