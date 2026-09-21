import type { MediaId, SignedUrl } from '@vidya/domain'
import { asId, mediaPath, toIsoDateTime } from '@vidya/domain'
import type { ResolveMediaRequest, ResolveMediaResponse } from '@vidya/protocol'
import { beforeEach, describe, expect, it } from 'vitest'

import type { HttpClient, HttpQuery } from '../../../ports'
import { createMediaUrls } from '../mediaUrls'

const LECTURE = asId<MediaId>('c3d4e5f6-7081-4923-ab4c-5d6e7f809102')

const NOON = Date.parse('2026-09-21T12:00:00.000Z')
const SIX_HOURS = 6 * 3600 * 1000

const EXTERNAL = 'https://archive.example.org/talks/1.mp4'
const OWN_ORIGIN = '/files/handout.pdf'

let answers: Record<string, SignedUrl> = {}

const signed = (id: MediaId): SignedUrl => ({
  url: `https://cdn.school.example/${id}/original`,
  expiresAt: toIsoDateTime(new Date(NOON + SIX_HOURS)),
})

const unused = (): never => {
  throw new Error('the resolver may only ask for a batch of addresses')
}

const http: HttpClient = {
  get: <TResponse>(_path: string, _query?: HttpQuery): Promise<TResponse> => unused(),
  patch: <TResponse>(_path: string, _body?: unknown): Promise<TResponse> => unused(),
  delete: (_path: string): Promise<void> => unused(),
  post: async <TResponse>(_path: string, body?: unknown): Promise<TResponse> => {
    const request = body as ResolveMediaRequest
    const urls = Object.fromEntries(
      request.ids.filter((id) => answers[id] !== undefined).map((id) => [id, answers[id]!]),
    )

    return { urls } as ResolveMediaResponse as TResponse
  },
}

const mediaUrls = () => createMediaUrls({ http, nowMs: () => NOON })

beforeEach(() => {
  answers = { [LECTURE]: signed(LECTURE) }
})

/**
 * What the resolver is allowed to hand to a `src`, and what it is not.
 *
 * A stored path under `/media/` is a name, and the address it stands for is
 * issued per read and checked per read. A string that looks like one and names
 * no file cannot be turned into an address, so there is nothing to answer with:
 * handing it back is a stored path in a `src`, which is exactly what the format
 * exists to prevent — and for `/media/../../secrets` it is a request aimed at
 * whatever the serving origin has.
 */
describe('a stored path that names no file of the school', () => {
  const refused = [
    '/media/not-an-id',
    '/media/../../secrets',
    '/media/',
    `${mediaPath(LECTURE)}?x=1`,
  ]

  it.each(refused)('knows no address for %s', async (path) => {
    const urls = mediaUrls()
    await urls.prime([path])

    expect(urls.resolve(path)).toBeUndefined()
  })

  it('knows no address for a stored path whose id is written in capitals', async () => {
    const urls = mediaUrls()
    await urls.prime([mediaPath(LECTURE)])

    expect(urls.resolve(mediaPath(asId<MediaId>(LECTURE.toUpperCase())))).toBeUndefined()
  })
})

/**
 * What is not a stored path is played as it is written.
 *
 * A link to someone else's server carries its own authorisation or needs none,
 * and a path on the serving origin outside `/media/` is served as it stands —
 * asking the school to sign either would fail and take the block dark for no
 * reason.
 */
describe('a source the school does not have to sign', () => {
  it('carries an external address through untouched', () => {
    expect(mediaUrls().resolve(EXTERNAL)).toBe(EXTERNAL)
  })

  it('carries a path on the serving origin through untouched', () => {
    expect(mediaUrls().resolve(OWN_ORIGIN)).toBe(OWN_ORIGIN)
  })
})
