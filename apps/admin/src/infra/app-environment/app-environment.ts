const basePath = import.meta.env.BASE_URL

if (!/^\/(?:[a-zA-Z0-9_-]+\/)*$/.test(basePath)) {
  throw new Error('Vite base должен быть абсолютным путём с завершающим слешем')
}

/**
 * Базовый путь сборки для маршрутизации и публичных адресов приложения.
 */
export const APP_BASE_PATH = basePath
