import type { RefreshTokensRequest, RefreshTokensResponse } from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import { config } from '../config'
import { useSession } from '../session'
import { announceFailures, reportFailure } from './failures'
import { FetchHttpClient } from './fetchHttpClient'
import { refreshOn401 } from './refreshOn401'
import type { HttpClient } from './types'

let client: HttpClient | undefined

/**
 * The composition root for the transport.
 *
 * Built once, so the refresh that follows a 401 is shared by the whole
 * application rather than by one caller. The token is read at call time rather
 * than captured, so signing in does not mean rebuilding every caller — which is
 * the mistake the admin this replaces made, pushing a fresh interceptor onto
 * the client on every single request.
 */
export const useApi = (): HttpClient => {
  if (client) return client

  const session = useSession()

  // The refresh call must not go through the guarded client: a refusal there
  // would be a 401 like any other, and the guard would send it back to itself.
  const bare = new FetchHttpClient({
    baseUrl: config.apiBaseUrl,
    accessToken: () => undefined,
  })

  const refresh = async (): Promise<boolean> => {
    const refreshToken = session.refreshToken.value
    if (!refreshToken) return false

    const tokens = await bare.post<RefreshTokensResponse>(Routes().auth.tokens.refresh(), {
      refreshToken,
    } satisfies RefreshTokensRequest)

    session.start(tokens)
    return true
  }

  client = announceFailures(
    refreshOn401(
      new FetchHttpClient({
        baseUrl: config.apiBaseUrl,
        accessToken: () => session.accessToken.value,
      }),
      { refresh, endSession: () => session.end() },
    ),
    // Outside the renewal, so a request that a refresh carried through is not
    // reported as the failure it briefly was.
    reportFailure,
  )

  return client
}

/** Tests build their own client; this drops the one the application cached. */
export const resetApi = (): void => {
  client = undefined
}
