import { beforeEach, describe, expect, it, vi } from 'vitest'

import { onRefreshTokenCleared, readRefreshToken, refreshTokenKey } from '../tokenStore'
import { useSession } from '../useSession'

const token = (exp: number) =>
  `header.${btoa(JSON.stringify({ sub: 'u1', exp, permissions: [] }))
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '')}.sig`

const LIVE = token(2_000_000_000)
const DEAD = token(1_000)

describe('useSession', () => {
  beforeEach(() => {
    localStorage.clear()
    useSession().end()
  })

  it('keeps the access token out of storage and the refresh token in it', () => {
    useSession().start({ accessToken: LIVE, refreshToken: 'refresh' })

    expect(readRefreshToken()).toBe('refresh')
    expect(JSON.stringify(localStorage)).not.toContain(LIVE)
  })

  it('clears both when the operator signs out', () => {
    const session = useSession()
    session.start({ accessToken: LIVE, refreshToken: 'refresh' })

    session.end()

    expect(session.accessToken.value).toBeUndefined()
    expect(session.refreshToken.value).toBeUndefined()
    expect(localStorage.getItem(refreshTokenKey)).toBeNull()
  })

  it('does not count an expired token as a live session', () => {
    const session = useSession()
    session.start({ accessToken: DEAD, refreshToken: 'refresh' })

    expect(session.isStale.value).toBe(true)
  })

  it('reads the subject out of the token', () => {
    const session = useSession()
    session.start({ accessToken: LIVE, refreshToken: 'refresh' })

    expect(session.userId.value).toBe('u1')
  })
})

describe('signing out in another tab', () => {
  beforeEach(() => {
    localStorage.clear()
    useSession().end()
  })

  const otherTabSignsOut = () => {
    localStorage.removeItem(refreshTokenKey)
    window.dispatchEvent(new StorageEvent('storage', { key: refreshTokenKey, newValue: null }))
  }

  it('ends the session in this tab too', () => {
    const session = useSession()
    const stop = onRefreshTokenCleared(() => session.forget())
    session.start({ accessToken: LIVE, refreshToken: 'refresh' })

    otherTabSignsOut()

    expect(session.isSignedIn.value).toBe(false)
    stop()
  })

  it('leaves the session alone while the refresh token is still there', () => {
    const session = useSession()
    const stop = onRefreshTokenCleared(() => session.forget())
    session.start({ accessToken: LIVE, refreshToken: 'refresh' })

    window.dispatchEvent(
      new StorageEvent('storage', { key: 'something.else', newValue: 'whatever' }),
    )

    expect(session.isSignedIn.value).toBe(true)
    stop()
  })

  it('ends the session when another tab clears storage wholesale', () => {
    const session = useSession()
    const stop = onRefreshTokenCleared(() => session.forget())
    session.start({ accessToken: LIVE, refreshToken: 'refresh' })

    // A cleared storage arrives as an event with a null key, not one per entry.
    localStorage.clear()
    window.dispatchEvent(new StorageEvent('storage', { key: null }))

    expect(session.isSignedIn.value).toBe(false)
    stop()
  })

  it('stops listening once it is told to', () => {
    const session = useSession()
    const handler = vi.fn()
    const stop = onRefreshTokenCleared(handler)
    session.start({ accessToken: LIVE, refreshToken: 'refresh' })

    stop()
    otherTabSignsOut()

    expect(handler).not.toHaveBeenCalled()
  })
})
