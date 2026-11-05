import { APP_BASE_PATH } from 'infra/app-environment'

/**
 * Публичный префикс API; proxy выбирает сервер, credential изолирован по этому URL.
 */
export const BACKEND_ADMIN_API_BASE_URL = `${APP_BASE_PATH}api`
