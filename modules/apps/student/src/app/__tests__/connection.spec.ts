import type { HttpClient } from '@vidya/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useConnection } from '@/shared/connection'

import { createSiteClient, renewSession } from '../connection'

const renewed = { accessToken: 'second-access', refreshToken: 'second-refresh' }

const fakeHttpClient = (answer: unknown) =>
  ({
    post: async () => {
      if (answer instanceof Error) throw answer
      return answer
    },
  }) as unknown as HttpClient

const signIn = () => {
  const connection = useConnection()
  connection.offer({ accessToken: 'first-access', refreshToken: 'first-refresh' })
  connection.signIn('user-1' as never)
}

describe('the transport of the one connection', () => {
  beforeEach(() => {
    localStorage.clear()
    useConnection().signOut()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('sends the session it holds now, not the one it was built with', async () => {
    const sent: RequestInit[] = []
    vi.stubGlobal('fetch', (_url: string, init: RequestInit) => {
      sent.push(init)
      return Promise.resolve(new Response('{}', { status: 200 }))
    })

    signIn()
    const http = createSiteClient()
    await http.get('/auth/profile')

    useConnection().adopt({ session: renewed })
    await http.get('/auth/profile')

    const authorisations = sent.map((call) => new Headers(call.headers).get('authorization'))
    expect(authorisations).toEqual(['Bearer first-access', 'Bearer second-access'])

    vi.unstubAllGlobals()
  })

  it('takes the renewed session, so the next run carries it', async () => {
    signIn()

    await expect(renewSession(fakeHttpClient(renewed))).resolves.toBe(true)
    expect(useConnection().connection.value?.session).toEqual(renewed)
  })

  it('answers that it could not renew, and signs nobody out for it', async () => {
    signIn()

    await expect(renewSession(fakeHttpClient(new Error('refused')))).resolves.toBe(false)

    const { connection, isSignedIn } = useConnection()
    expect(isSignedIn.value).toBe(true)
    expect(connection.value?.needsSignIn).toBe(true)
  })

  it('does not ask for a renewal it has no token for', async () => {
    const asked = vi.fn()

    await expect(renewSession({ post: asked } as unknown as HttpClient)).resolves.toBe(false)
    expect(asked).not.toHaveBeenCalled()
  })
})
