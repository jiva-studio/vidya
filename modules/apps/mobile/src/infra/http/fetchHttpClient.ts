import type { HttpClient, HttpQuery } from '@/ports'
import { HttpError, OfflineError } from '@/ports'

interface FetchHttpClientOptions {
  readonly baseUrl: string
  readonly accessToken: () => string | undefined
}

const queryString = (query: HttpQuery | undefined): string => {
  if (!query) return ''
  const pairs = Object.entries(query).filter(([, value]) => value !== undefined)
  return pairs.length === 0 ? '' : `?${new URLSearchParams(pairs.map(([k, v]) => [k, String(v)]))}`
}

/** The only place in the app that knows fetch exists. */
export class FetchHttpClient implements HttpClient {
  constructor(private readonly options: FetchHttpClientOptions) {}

  get<TResponse>(path: string, query?: HttpQuery): Promise<TResponse> {
    return this.send<TResponse>('GET', `${path}${queryString(query)}`)
  }

  post<TResponse>(path: string, body?: unknown): Promise<TResponse> {
    return this.send<TResponse>('POST', path, body)
  }

  patch<TResponse>(path: string, body?: unknown): Promise<TResponse> {
    return this.send<TResponse>('PATCH', path, body)
  }

  async delete(path: string): Promise<void> {
    await this.send<unknown>('DELETE', path)
  }

  private async send<TResponse>(method: string, path: string, body?: unknown): Promise<TResponse> {
    const response = await this.call(method, path, body)
    if (!response.ok) throw new HttpError(response.status, path)
    if (response.status === 204) return undefined as TResponse
    return (await response.json()) as TResponse
  }

  private async call(method: string, path: string, body?: unknown): Promise<Response> {
    const token = this.options.accessToken()
    try {
      return await fetch(`${this.options.baseUrl}${path}`, {
        method,
        headers: {
          accept: 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      // A transport failure carries no status code, so it needs its own type.
    } catch {
      throw new OfflineError(path)
    }
  }
}
