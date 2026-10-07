import { AdminRestApiTransportError } from '../errors'

/**
 * Выполняет fetch с явной классификацией transport failure.
 */
export const adminRestApiFetch: typeof fetch = async (...params) => {
  try {
    return await fetch(...params)
  } catch (error) {
    const code = error instanceof DOMException && error.name === 'AbortError' ? 'REQUEST_TIMEOUT' : 'NETWORK_UNAVAILABLE'

    throw new AdminRestApiTransportError(code, error)
  }
}
