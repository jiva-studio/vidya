import type { RefreshTokensRequest, RefreshTokensResponse } from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import { FetchHttpClient } from '@/shared/api'
import { config } from '@/shared/config'
import { onRefreshTokenCleared, readRefreshToken, useSession } from '@/shared/session'

/**
 * Turns the stored refresh token into a live session, before the first route.
 *
 * The access token is deliberately not persisted, so every reload starts
 * without one. Doing this after the router has resolved would bounce a direct
 * link to the sign-in screen and back, which is exactly what a pasted link
 * must not do.
 */
export const restoreSession = async (): Promise<void> => {
  const refreshToken = readRefreshToken()
  if (!refreshToken) return

  const http = new FetchHttpClient({ baseUrl: config.apiBaseUrl, accessToken: () => undefined })

  try {
    const tokens = await http.post<RefreshTokensResponse>(Routes().auth.tokens.refresh(), {
      refreshToken,
    } satisfies RefreshTokensRequest)
    useSession().start(tokens)
    // A refused or unreachable refresh is not a live session; the guard sends
    // the visitor to sign in, carrying where they were going.
  } catch {
    useSession().end()
  }
}

/**
 * Makes signing out in one tab take the others with it.
 *
 * The admin is kept open in two tabs for a working day. Without this the second
 * one keeps a full menu over a session the server has already forgotten, and
 * every click answers with a refusal nobody expected.
 */
export const watchOtherTabs = (): (() => void) => onRefreshTokenCleared(() => useSession().forget())
