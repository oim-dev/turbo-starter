type UnauthorizedListener = () => void

const unauthorizedListeners = new Set<UnauthorizedListener>()

/** Подписывает auth composition на отзыв серверной сессии. */
export const onAdminRestApiUnauthorized = (listener: UnauthorizedListener): (() => void) => {
  unauthorizedListeners.add(listener)
  return () => {
    unauthorizedListeners.delete(listener)
  }
}

/** Уведомляет подписчиков об отклонённой BFF-сессии. */
export const emitAdminRestApiUnauthorized = (): void => {
  unauthorizedListeners.forEach((listener) => listener())
}
