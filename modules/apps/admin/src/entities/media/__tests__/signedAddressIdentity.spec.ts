import { Routes } from '@vidya/protocol'
import { afterEach, describe, expect, it } from 'vitest'

import { useSession } from '@/shared/session'
import { fakeHttpClient, signInAs, STORY_SCHOOL } from '@/shared/testing'

import { HttpMediaGateway } from '..'

const Urls = Routes().media.urls()

const STORED = '/media/00000000-0000-4000-8000-000000000001'
const ADDRESS = 'https://cdn.test/one.png?sig=1'

const ANOTHER_SCHOOL = 'school-2'

/** The server's answer to a batch, signed for whoever is asking. */
const answering = () => ({
  [`POST ${Urls}`]: {
    urls: {
      [STORED.slice('/media/'.length)]: { url: ADDRESS, expiresAt: '2026-09-21T13:00:00.000Z' },
    },
  },
})

const primed = async () => {
  const http = fakeHttpClient(answering())
  const gateway = new HttpMediaGateway(http.client)

  await gateway.prime?.([STORED])

  return { gateway, http }
}

describe('an address held for the operator who earned it', () => {
  afterEach(() => {
    useSession().end()
  })

  it('answers the operator who primed the screen, for as long as they are signed in', async () => {
    signInAs(['media:read'])
    const { gateway } = await primed()

    expect(gateway.resolve(STORED)).toBe(ADDRESS)
    expect(gateway.resolve(STORED)).toBe(ADDRESS)
  })

  it('answers nothing once the session has ended', async () => {
    signInAs(['media:read'])
    const { gateway } = await primed()

    useSession().end()

    expect(gateway.resolve(STORED)).toBeUndefined()
  })

  it('answers nothing to the next school signed into the same tab', async () => {
    signInAs(['media:read'], STORY_SCHOOL)
    const { gateway } = await primed()

    signInAs(['media:read'], ANOTHER_SCHOOL)

    expect(gateway.resolve(STORED)).toBeUndefined()
  })

  it('answers the next school once that school has primed the screen itself', async () => {
    signInAs(['media:read'], STORY_SCHOOL)
    const { gateway } = await primed()

    signInAs(['media:read'], ANOTHER_SCHOOL)
    await gateway.prime?.([STORED])

    expect(gateway.resolve(STORED)).toBe(ADDRESS)
  })
})
