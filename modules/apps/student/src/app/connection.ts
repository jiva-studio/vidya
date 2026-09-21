import type { HttpClient } from '@vidya/client'
import { httpClientFor } from '@vidya/client'
import type { RefreshTokensRequest, RefreshTokensResponse } from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import { config } from '@/shared/config'
import { useConnection } from '@/shared/connection'

/**
 * The one transport this site has, and the only place that builds one.
 *
 * Everything a student does reaches the server through synchronisation;
 * signing in is the exchange that happens before there is anything to
 * synchronise, and it borrows this same client. The session is read per
 * request rather than captured, because it is replaced whole whenever a token
 * is renewed and a client holding the old one would go on sending it.
 */
export const createSiteClient = (): HttpClient =>
  httpClientFor({ baseUrl: config.apiBaseUrl, session: () => useConnection().session.value })

/**
 * Trades the refresh token for a fresh session, answering `false` on any
 * failure.
 *
 * It ends nothing. The student keeps reading what is already on this machine;
 * only the network half waits for a new sign-in, and a run that cannot renew
 * defers rather than signing anyone out.
 */
export const renewSession = async (http: HttpClient): Promise<boolean> => {
  const { connection, adopt } = useConnection()
  const refreshToken = connection.value?.session.refreshToken
  if (refreshToken === undefined) return false

  try {
    const renewed = await http.post<RefreshTokensResponse>(Routes().auth.tokens.refresh(), {
      refreshToken,
    } satisfies RefreshTokensRequest)

    adopt({
      session: { accessToken: renewed.accessToken, refreshToken: renewed.refreshToken },
      needsSignIn: false,
    })

    return true
  } catch (error) {
    // Reported by answering `false`: the run defers and the connection is
    // marked as needing a sign-in. Raising here would end the session, which
    // is what must not happen.
    console.warn('the session could not be renewed', error)
    adopt({ needsSignIn: true })

    return false
  }
}
