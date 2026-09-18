import { createGlobalState } from '@vueuse/core'
import { computed, ref, shallowRef } from 'vue'

import { hasExpired, readAccessToken, schoolsOf } from './accessToken'
import { clearRefreshToken, readRefreshToken, writeRefreshToken } from './tokenStore'
import type { SessionTokens } from './types'

/**
 * The signed-in session, held once for the whole application.
 *
 * The access token is a plain ref rather than anything persisted: it must not
 * outlive the tab. Everything the interface decides about rights is derived
 * from it, so there is exactly one place the answer comes from.
 */
export const useSession = createGlobalState(() => {
  const accessToken = shallowRef<string | undefined>(undefined)
  const refreshToken = shallowRef<string | undefined>(readRefreshToken())

  // Injected so a test can place the clock, and so an expiring token does not
  // depend on when a component happened to re-render.
  const nowSeconds = ref(Math.floor(Date.now() / 1000))

  const claims = computed(() => readAccessToken(accessToken.value))
  const permissions = computed(() => claims.value?.permissions ?? [])
  const schoolIds = computed(() => schoolsOf(permissions.value))
  const userId = computed(() => claims.value?.sub)
  const isSignedIn = computed(() => claims.value !== undefined)
  const isStale = computed(() => hasExpired(claims.value, nowSeconds.value))

  const start = (tokens: SessionTokens) => {
    writeRefreshToken(tokens.refreshToken)
    refreshToken.value = tokens.refreshToken
    accessToken.value = tokens.accessToken
    nowSeconds.value = Math.floor(Date.now() / 1000)
  }

  const end = () => {
    clearRefreshToken()
    refreshToken.value = undefined
    accessToken.value = undefined
  }

  /** Drops the in-memory half only: another tab has already cleared storage. */
  const forget = () => {
    refreshToken.value = undefined
    accessToken.value = undefined
  }

  return {
    accessToken,
    refreshToken,
    claims,
    permissions,
    schoolIds,
    userId,
    isSignedIn,
    isStale,
    nowSeconds,
    start,
    end,
    forget,
  }
})
