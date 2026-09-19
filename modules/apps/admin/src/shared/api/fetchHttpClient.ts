import { HttpError, OfflineError } from './errors'
import type { FetchHttpClientOptions, HttpClient, HttpQuery } from './types'

const queryString = (query: HttpQuery | undefined): string => {
  if (!query) return ''
  const pairs = Object.entries(query).filter(([, value]) => value !== undefined)
  if (pairs.length === 0) return ''
  return `?${new URLSearchParams(pairs.map(([key, value]) => [key, String(value)]))}`
}

const parse = async (response: Response): Promise<unknown> => {
  if (response.status === 204) return undefined
  const text = await response.text()
  if (text.length === 0) return undefined
  try {
    return JSON.parse(text)
    // A body that is not JSON is still worth carrying: it is what the screen shows.
  } catch {
    return text
  }
}

/** The only place in the application that knows fetch exists. */
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
    const payload = await parse(response)
    if (!response.ok) throw new HttpError(response.status, path, payload)
    return payload as TResponse
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
