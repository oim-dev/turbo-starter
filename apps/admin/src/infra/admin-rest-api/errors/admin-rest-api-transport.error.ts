/**
 * Причина сбоя непосредственно на transport-границе Admin REST API.
 */
export type AdminRestApiTransportErrorCode = 'NETWORK_UNAVAILABLE' | 'REQUEST_TIMEOUT'

/**
 * Маркирует fetch failure, не смешивая его с TypeError из прикладного кода.
 */
export class AdminRestApiTransportError extends Error {
  readonly code: AdminRestApiTransportErrorCode
  readonly cause: unknown

  constructor(code: AdminRestApiTransportErrorCode, cause: unknown) {
    super(code)

    this.name = 'AdminRestApiTransportError'
    this.code = code
    this.cause = cause
  }
}
