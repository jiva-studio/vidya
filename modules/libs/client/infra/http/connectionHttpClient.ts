import type { HttpClient, Session } from '../../ports'
import { FetchHttpClient } from './fetchHttpClient'

/**
 * A transport bound to one server.
 *
 * The address is closed over rather than passed per call, so a token held for
 * one school has nowhere else to travel: a caller holding this client can only
 * reach the server the connection names.
 *
 * The session is read per request because it is replaced whenever a token is
 * renewed, and a client built around a captured token would keep sending the
 * expired one.
 */
export const httpClientFor = (connection: {
  readonly baseUrl: string
  readonly session: () => Session | undefined
}): HttpClient =>
  new FetchHttpClient({
    baseUrl: connection.baseUrl,
    accessToken: () => connection.session()?.accessToken,
  })
