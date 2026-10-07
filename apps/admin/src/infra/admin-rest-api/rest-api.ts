import { createApiClient } from '@biocad/admin-rest-api-sdk/create-api-client'
import { operationsTree } from '@biocad/admin-rest-api-sdk/operations-tree'

import { adminHttpClient } from './client'

/** Полный bound-клиент Admin REST API. */
export const adminRestApi = createApiClient(adminHttpClient, operationsTree)
