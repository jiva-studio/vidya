import { Routes } from '@vidya/protocol'
import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { manualClock } from '@/shared/lib'
import { fakeHttpClient, refusal } from '@/shared/testing'

import type { MediaGateway } from '..'
import { FakeMediaGateway, HttpMediaGateway, MediaError } from '..'

const Urls = Routes().media.urls()

const STORED = '/media/00000000-0000-4000-8000-000000000001'
const ALSO_STORED = '/media/00000000-0000-4000-8000-000000000002'
const EXTERNAL = 'https://example.org/a.png'

const idOf = (path: string) => path.slice('/media/'.length)

/**
 * The batch call, or a loud failure when a gateway has none.
 *
 * `prime` is optional on the contract — a gateway holding its own files has
 * nothing to ask anyone — so a screen that needs one has to find out here
 * rather than by drawing nothing.
 */
const priming = (gateway: MediaGateway): ((urls: string[]) => Promise<void>) => {
  const prime = gateway.prime?.bind(gateway)
  if (!prime) throw new Error('this gateway offers no prime, so no screen can draw a stored file')

  return prime
}

/** The server's answer to a batch: an address per id it lets this caller read. */
const answering = (addresses: Record<string, string>) => ({
  [`POST ${Urls}`]: {
    urls: Object.fromEntries(
      Object.entries(addresses).map(([path, url]) => [
        idOf(path),
        { url, expiresAt: '2026-09-21T13:00:00.000Z' },
      ]),
    ),
  },
})

const file = (name: string, type = 'image/png') => new File(['x'.repeat(64)], name, { type })

/** Moves the fake's own clock until the upload it was given has settled. */
const settle = async <TResult>(
  promise: Promise<TResult>,
  clock: ReturnType<typeof manualClock>,
): Promise<TResult> => {
  let done = false
  const finished = promise.finally(() => {
    done = true
  })

  finished.catch(() => undefined)

  for (let tick = 0; tick < 200 && !done; tick += 1) {
    clock.advance(50)
    await flushPromises()
  }

  return finished
}

describe('priming a screen before it draws', () => {
  it('takes a prime on the fake without asking anything of anyone', async () => {
    const gateway = new FakeMediaGateway({ clock: manualClock() })

    await expect(priming(gateway)([STORED])).resolves.toBeUndefined()
  })

  it('leaves the fake resolving this session uploads exactly as it did before', async () => {
    const clock = manualClock()
    const gateway = new FakeMediaGateway({ clock })
    const record = await settle(gateway.upload({ file: file('Chart.png') }), clock)

    await priming(gateway)([record.url])

    expect(gateway.resolve(record.url)).toMatch(/^blob:/)
  })

  it('primes a path the session never uploaded without pretending to know it', async () => {
    const gateway = new FakeMediaGateway({ clock: manualClock() })

    await priming(gateway)([ALSO_STORED])

    expect(gateway.resolve(ALSO_STORED)).toBeUndefined()
  })

  it('answers an unprimed path with nothing, which is what a fresh screen holds', () => {
    const http = fakeHttpClient(answering({}))
    const gateway = new HttpMediaGateway(http.client)

    expect(gateway.resolve(STORED)).toBeUndefined()
    expect(http.calls).toEqual([])
  })

  it('answers a primed path from hand, with no promise for the element to wait on', async () => {
    const http = fakeHttpClient(answering({ [STORED]: 'https://cdn.test/one.png?sig=1' }))
    const gateway = new HttpMediaGateway(http.client)

    await priming(gateway)([STORED])

    expect(gateway.resolve(STORED)).toBe('https://cdn.test/one.png?sig=1')
  })

  it('asks for a whole screen in one call, naming ids and not paths', async () => {
    const http = fakeHttpClient(
      answering({
        [STORED]: 'https://cdn.test/one.png?sig=1',
        [ALSO_STORED]: 'https://cdn.test/two.png?sig=1',
      }),
    )
    const gateway = new HttpMediaGateway(http.client)

    await priming(gateway)([STORED, ALSO_STORED, EXTERNAL, STORED])

    expect(http.callsTo(Urls)).toHaveLength(1)
    expect(http.callsTo(Urls)[0].body).toEqual({ ids: [idOf(STORED), idOf(ALSO_STORED)] })
  })

  it('keeps holding nothing for a file the answer left out', async () => {
    const http = fakeHttpClient(answering({ [STORED]: 'https://cdn.test/one.png?sig=1' }))
    const gateway = new HttpMediaGateway(http.client)

    await priming(gateway)([STORED, ALSO_STORED])

    expect(gateway.resolve(STORED)).toBe('https://cdn.test/one.png?sig=1')
    expect(gateway.resolve(ALSO_STORED)).toBeUndefined()
  })

  it('refuses with a reason a screen can show rather than with a status code', async () => {
    const http = fakeHttpClient({ [`POST ${Urls}`]: refusal(503, 'gateway down', Urls) })
    const gateway = new HttpMediaGateway(http.client)

    await expect(priming(gateway)([STORED])).rejects.toBeInstanceOf(MediaError)
  })

  it('names the reason with a key the locale bundle holds', async () => {
    const http = fakeHttpClient({ [`POST ${Urls}`]: refusal(503, 'gateway down', Urls) })
    const gateway = new HttpMediaGateway(http.client)

    const refused = await priming(gateway)([STORED]).catch((failure: unknown) => failure)

    expect((refused as MediaError).reason).toMatch(/^media-/)
  })

  it('troubles nobody for a screen whose media is all somewhere else', async () => {
    const http = fakeHttpClient(answering({}))
    const gateway = new HttpMediaGateway(http.client)

    await priming(gateway)([EXTERNAL])

    expect(http.calls).toEqual([])
    expect(gateway.resolve(EXTERNAL)).toBe(EXTERNAL)
  })
})
