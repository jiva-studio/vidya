import { beforeEach, describe, expect, it } from 'vitest'

import { useConnection } from '../useConnection'

const tokens = { accessToken: 'access-token', refreshToken: 'refresh-token' }

const signIn = () => {
  const connection = useConnection()
  connection.offer(tokens)
  connection.signIn('user-1' as never)
}

/**
 * One connection, because there is one server: what is kept of it between
 * visits, and what deliberately is not.
 */
describe('the one connection', () => {
  beforeEach(() => {
    localStorage.clear()
    useConnection().signOut()
  })

  it('carries the offered tokens until the server says whose they are', () => {
    const connection = useConnection()

    connection.offer(tokens)

    expect(connection.session.value).toEqual(tokens)
    expect(connection.isSignedIn.value).toBe(false)
  })

  it('refuses to sign in with tokens nobody offered', () => {
    expect(() => useConnection().signIn('user-1' as never)).toThrow()
  })

  it('comes back after a reload without the access token', () => {
    // A reload as the store sees it: what was written last time, and a state
    // that has never held anything.
    localStorage.setItem(
      'vidya.student.connection',
      JSON.stringify({ ownerId: 'user-1', refreshToken: 'refresh-token' }),
    )

    const connection = useConnection()
    connection.restore()

    expect(connection.connection.value?.ownerId).toBe('user-1')
    expect(connection.connection.value?.session.refreshToken).toBe('refresh-token')
    expect(connection.connection.value?.session.accessToken).toBe('')
  })

  it('takes a renewed session and keeps the new refresh token for next time', () => {
    signIn()
    const connection = useConnection()

    connection.adopt({ session: { accessToken: 'second', refreshToken: 'second-refresh' } })

    expect(connection.connection.value?.session.accessToken).toBe('second')
    expect(localStorage.getItem('vidya.student.connection')).toContain('second-refresh')
  })

  it('records a refused renewal without taking away what is already here', () => {
    signIn()
    const connection = useConnection()

    connection.adopt({ needsSignIn: true })

    expect(connection.connection.value?.needsSignIn).toBe(true)
    expect(connection.isSignedIn.value).toBe(true)
  })

  it('leaves nothing behind when the student signs out', () => {
    signIn()
    const connection = useConnection()

    connection.signOut()

    expect(connection.connection.value).toBeUndefined()
    expect(connection.session.value).toBeUndefined()
    expect(localStorage.getItem('vidya.student.connection')).toBeNull()
  })

  it('treats a stored value it cannot read as nobody being signed in', () => {
    localStorage.setItem('vidya.student.connection', 'not json')
    const connection = useConnection()

    connection.restore()

    expect(connection.connection.value).toBeUndefined()
  })

  it('handles storage access exceptions gracefully without throwing', () => {
    const original = window.localStorage
    try {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new Error('SecurityError: Access is denied')
        },
        configurable: true,
      })
      const connection = useConnection()
      expect(() => connection.restore()).not.toThrow()
      expect(connection.connection.value).toBeUndefined()
    } finally {
      Object.defineProperty(window, 'localStorage', {
        value: original,
        configurable: true,
      })
    }
  })
})
