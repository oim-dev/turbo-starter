import { isNonEmptyString } from '@biocad/value-predicates'
import { Navigate, useParams } from 'react-router-dom'

import { PublicationEditScreen } from 'compositions/screens/publication-edit'

/**
 * Route редактирования публикации.
 *
 * Используется для:
 *  - проверки динамического route parameter
 *  - передачи UUID экрану редактирования
 */
export const PublicationEditRouteEntry = () => {
  const { publicationId } = useParams()

  if (!isNonEmptyString(publicationId)) {
    return <Navigate replace to="/publications" />
  }

  return <PublicationEditScreen publicationId={publicationId} />
}
