import { HttpClient as GeneratedHttpClient } from './generated/http-client.js'
import type { ApiConfig, HttpResponse, ResponseFormat } from './generated/http-client.js'
export { ApiError, ContentType } from './generated/http-client.js'

/**
 * Сохраняет разбор JSON-ошибок, в том числе у REST-операций без формата успешного ответа.
 */
export class HttpClient extends GeneratedHttpClient {
  constructor(config: ApiConfig = {}) {
    super(config)
    const parse = this.parseResponse
    this.parseResponse = async <T = unknown, E = unknown>(
      response: Response,
      format?: ResponseFormat
    ): Promise<HttpResponse<T, E>> => {
      const isJsonError = !response.ok && response.headers.get('content-type')?.includes('application/json')
      return parse<T, E>(response, isJsonError ? 'json' : format)
    }
  }
}
export type {
  ApiConfig,
  ApiRequestClient,
  CancelToken,
  ErrorInterceptor,
  FetchLike,
  FullRequestParams,
  HttpResponse,
  ParamsSerializer,
  QueryParamsType,
  RequestContext,
  RequestInterceptor,
  RequestParams,
  ResponseFormat,
  ResponseInterceptor,
  ResponseParser
} from './generated/http-client.js'
