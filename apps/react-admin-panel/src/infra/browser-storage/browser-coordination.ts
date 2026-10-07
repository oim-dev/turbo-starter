/**
 * Origin-scoped serialization and value-free notifications.
 */
type BrowserCoordination = {
  /**
   * Keeps exclusivity until the callback's asynchronous result settles.
   */
  runExclusive: <T>(onAcquired: () => Promise<T>) => Promise<T>
  /**
   * Asks peers to reread storage; no application data is transferred.
   */
  notify: () => void
  /**
   * Releases the notification channel and browser listeners.
   */
  dispose: () => void
}

/**
 * Coordinates same-origin storage users without transferring stored values.
 */
export const createBrowserCoordination = (name: string, onChange: () => void): BrowserCoordination => {
  if (typeof navigator.locks?.request !== 'function' || typeof BroadcastChannel !== 'function') {
    throw new Error('Browser coordination is unavailable')
  }

  const locks = navigator.locks
  const channel = new BroadcastChannel(name)
  /**
   * Treats notifications as hints; consumers must read storage again under the lock.
   */
  const handleStorage = (event: StorageEvent) => {
    if (event.key === name || event.key === null) {
      onChange()
    }
  }

  channel.addEventListener('message', onChange)
  window.addEventListener('storage', handleStorage)
  window.addEventListener('focus', onChange)
  window.addEventListener('pageshow', onChange)

  return {
    runExclusive: async <T>(onAcquired: () => Promise<T>): Promise<T> => await locks.request(name, onAcquired),
    notify: (): void => channel.postMessage(null),
    dispose: (): void => {
      channel.close()
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('focus', onChange)
      window.removeEventListener('pageshow', onChange)
    }
  }
}
