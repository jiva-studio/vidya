import type { HttpClient } from '@vidya/client'
import type { MediaId } from '@vidya/domain'
import { asId, mediaPath, toIsoDateTime } from '@vidya/domain'
import type { ResolveMediaResponse } from '@vidya/protocol'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { StartedSync } from '../sync'

const LECTURE = asId<MediaId>('c3d4e5f6-7081-4923-ab4c-5d6e7f809102')

const EXTERNAL = 'https://archive.example.org/talks/1.mp4'

const addressAt = (host: string): string => `https://${host}/${LECTURE}/original?token=abc`

/** What the app believes is running. Emptied to model a signed-out device. */
const running: StartedSync[] = []

vi.mock('../sync', () => ({ runningSyncs: () => running }))

const { useMediaUrls } = await import('../mediaUrls')

/** A connection whose school answers with an address of its own. */
const schoolAt = (host: string): StartedSync =>
  ({
    http: {
      post: async () =>
        ({
          urls: {
            [LECTURE]: {
              url: addressAt(host),
              expiresAt: toIsoDateTime(new Date(Date.now() + 6 * 3600 * 1000)),
            },
          },
        }) as ResolveMediaResponse,
    } as unknown as HttpClient,
  }) as unknown as StartedSync

const run = (started: StartedSync): void => {
  running.splice(0, running.length, started)
}

beforeEach(() => {
  running.length = 0
})

/**
 * An address belongs to the identity that earned it.
 *
 * A read signature lasts hours and needs no session to be used, so one held past
 * a sign-out is a file of a school the student has left, still playable on the
 * device — and one held across a switch is a file of one school answering for
 * another.
 */
describe('the addresses the app holds for a school', () => {
  it('answers with nothing once the student has signed out', async () => {
    run(schoolAt('cdn.first.example'))
    const urls = useMediaUrls()
    await urls.prime([mediaPath(LECTURE)])

    running.length = 0

    expect(urls.resolve(mediaPath(LECTURE))).toBeUndefined()
  })

  it('answers with nothing for the school the student has switched away from', async () => {
    run(schoolAt('cdn.first.example'))
    await useMediaUrls().prime([mediaPath(LECTURE)])

    run(schoolAt('cdn.second.example'))

    expect(useMediaUrls().resolve(mediaPath(LECTURE))).toBeUndefined()
  })

  /**
   * An external link is not a signed address, so no identity owns it: a lesson
   * pointing at someone else's server reads the same signed in and signed out,
   * and a screen drawn while the engines are still starting shows it rather than
   * a notice about a file that was never the school's.
   */
  it('carries an external address through with no connection running', () => {
    expect(useMediaUrls().resolve(EXTERNAL)).toBe(EXTERNAL)
  })
})
