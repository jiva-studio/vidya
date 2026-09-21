import { flushPromises } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { manualClock } from '@/shared/lib'

import type { MediaGateway } from '..'
import { FakeMediaGateway, HttpMediaGateway } from '..'

/**
 * The batch a screen asks for before it draws.
 *
 * Declared here rather than imported because it is the part of the gateway
 * contract this suite is asking for: an `img` cannot wait for a promise, so the
 * screen resolves everything first and `resolve` stays synchronous.
 */
type Priming = { prime(urls: string[]): Promise<void> }

const priming = (gateway: MediaGateway): Priming => gateway as unknown as Priming

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

    await expect(
      priming(gateway).prime(['/media/00000000-0000-4000-8000-000000000001']),
    ).resolves.toBeUndefined()
  })

  it('leaves the fake resolving this session uploads exactly as it did before', async () => {
    const clock = manualClock()
    const gateway = new FakeMediaGateway({ clock })
    const record = await settle(gateway.upload({ file: file('Chart.png') }), clock)

    await priming(gateway).prime([record.url])

    expect(gateway.resolve(record.url)).toMatch(/^blob:/)
  })

  it('answers an unprimed path with nothing, which is what a fresh screen holds', async () => {
    const gateway = new HttpMediaGateway()

    expect(gateway.resolve('/media/00000000-0000-4000-8000-000000000001')).toBeUndefined()
  })

  it('primes a path the session never uploaded without pretending to know it', async () => {
    const gateway = new FakeMediaGateway({ clock: manualClock() })
    const stored = '/media/00000000-0000-4000-8000-000000000002'

    await priming(gateway).prime([stored])

    expect(gateway.resolve(stored)).toBeUndefined()
  })
})
