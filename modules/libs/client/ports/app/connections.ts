import type { UserId } from '@vidya/domain'

import type { Session } from '../session'

/**
 * One server the app talks to, with the identity it holds there.
 *
 * A person can study in schools that live on different servers, so a session is
 * per server rather than global. `ownerId` keys every table on the device and
 * comes from the server's own profile endpoint: the token alone does not say
 * who its bearer is.
 */
export interface Connection {
  /** Normalised before comparison, so `https://a.ru/` and `https://a.ru` are one server. */
  readonly baseUrl: string

  readonly ownerId: UserId
  readonly session: Session

  /** Set when a refresh failed; reading stays open, syncing waits for a new sign-in. */
  readonly needsSignIn: boolean
}

export interface IConnectionStore {
  list(): Promise<readonly Connection[]>
  add(connection: Connection): Promise<void>
  update(baseUrl: string, changes: Partial<Omit<Connection, 'baseUrl'>>): Promise<void>
  remove(baseUrl: string): Promise<void>
}

/** An address that is not a URL at all, kept apart from a server refusing to answer. */
export class InvalidServerAddressError extends Error {
  constructor(value: string) {
    super(`not a server address: ${value}`)
    this.name = 'InvalidServerAddressError'
  }
}

/**
 * Host case, default port, query, fragment and trailing slash removed; the path
 * is kept, because a server deployed under one lives at that path and nowhere
 * else.
 *
 * Connections are identified by this string alone; without it the same server
 * reached by two spellings becomes two connections, two sign-ins and two copies
 * of the same data.
 */
export const normaliseBaseUrl = (value: string): string => {
  let url: URL
  try {
    url = new URL(value)
  } catch {
    throw new InvalidServerAddressError(value)
  }

  const port =
    (url.protocol === 'https:' && url.port === '443') ||
    (url.protocol === 'http:' && url.port === '80')
      ? ''
      : url.port

  const path = url.pathname.replace(/\/+$/, '')

  return `${url.protocol}//${url.hostname.toLowerCase()}${port ? `:${port}` : ''}${path}`
}
