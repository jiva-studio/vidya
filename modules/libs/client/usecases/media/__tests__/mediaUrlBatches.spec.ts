import type { MediaId, SignedUrl } from '@vidya/domain'
import { asId, mediaPath, toIsoDateTime } from '@vidya/domain'
import type { ResolveMediaRequest, ResolveMediaResponse } from '@vidya/protocol'
import { MediaResolveLimit } from '@vidya/protocol'
import { beforeEach, describe, expect, it } from 'vitest'

import type { HttpClient, HttpQuery } from '../../../ports'
import { createMediaUrls } from '../mediaUrls'

const LECTURE = asId<MediaId>('c3d4e5f6-7081-4923-ab4c-5d6e7f809102')

const NOON = Date.parse('2026-09-21T12:00:00.000Z')
const SIX_HOURS = 6 * 3600 * 1000

let asked: ResolveMediaRequest[] = []

/** Every answer the transport has been handed, in the order it was asked. */
let pending: ((answer: ResolveMediaResponse) => void)[] = []

const signed = (id: MediaId, tag: string): SignedUrl => ({
  url: `https://cdn.school.example/${id}/original?token=${tag}`,
  expiresAt: toIsoDateTime(new Date(NOON + SIX_HOURS)),
})

const unused = (): never => {
  throw new Error('the resolver may only ask for a batch of addresses')
}

/** A transport that answers when the test says so, and in the order it chooses. */
const deferred: HttpClient = {
  get: <TResponse>(_path: string, _query?: HttpQuery): Promise<TResponse> => unused(),
  patch: <TResponse>(_path: string, _body?: unknown): Promise<TResponse> => unused(),
  delete: (_path: string): Promise<void> => unused(),
  post: <TResponse>(_path: string, body?: unknown): Promise<TResponse> => {
    asked.push(body as ResolveMediaRequest)

    return new Promise<ResolveMediaResponse>((resolve) =>
      pending.push(resolve),
    ) as Promise<TResponse>
  },
}

/** A transport that answers every id it is asked about, at once. */
const answering: HttpClient = {
  ...deferred,
  post: async <TResponse>(_path: string, body?: unknown): Promise<TResponse> => {
    const request = body as ResolveMediaRequest
    asked.push(request)

    const urls = Object.fromEntries(request.ids.map((id) => [id, signed(id, 'v1')]))

    return { urls } as ResolveMediaResponse as TResponse
  },
}

const mediaUrls = (http: HttpClient) => createMediaUrls({ http, nowMs: () => NOON })

const manyPaths = (count: number): string[] =>
  Array.from({ length: count }, (_, at) =>
    mediaPath(asId<MediaId>(`00000000-0000-4000-8000-${String(at + 1).padStart(12, '0')}`)),
  )

beforeEach(() => {
  asked = []
  pending = []
})

/**
 * Two batches naming the same file, answered out of order.
 *
 * A screen primes on mount and again when the radio comes back, so two requests
 * for one file are in flight as a matter of course. The map has to end up
 * holding what the school said last, not what arrived last: an older answer that
 * refused the read would otherwise erase the grant that replaced it, and the
 * block goes dark on a working connection.
 */
describe('a batch answered after a later one', () => {
  it('keeps the address the newer batch was granted', async () => {
    const urls = mediaUrls(deferred)

    const first = urls.prime([mediaPath(LECTURE)])
    const second = urls.prime([mediaPath(LECTURE)])

    pending[1]!({ urls: { [LECTURE]: signed(LECTURE, 'v2') } })
    await second

    pending[0]!({ urls: {} })
    await first

    expect(urls.resolve(mediaPath(LECTURE))).toBe(signed(LECTURE, 'v2').url)
  })
})

/**
 * The batch the server accepts is capped, and a section can name more.
 *
 * Posters count towards it, so a long lesson passes the limit without anybody
 * writing a long lesson on purpose. One request over the cap is refused whole,
 * which takes down every file on the screen rather than the last one.
 */
describe('a screen naming more files than one request may carry', () => {
  it('reads the size of a request from the contract both sides share', () => {
    expect(MediaResolveLimit).toBeGreaterThan(0)
  })

  it('asks in requests no larger than the server accepts', async () => {
    const urls = mediaUrls(answering)
    const paths = manyPaths(MediaResolveLimit + 20)

    await urls.prime(paths)

    const sizes = asked.map((request) => request.ids.length)

    expect(sizes.reduce((total, size) => total + size, 0)).toBe(paths.length)
    expect(Math.max(...sizes)).toBeLessThanOrEqual(MediaResolveLimit)
  })

  it('answers every one of them afterwards', async () => {
    const urls = mediaUrls(answering)
    const paths = manyPaths(MediaResolveLimit + 20)

    await urls.prime(paths)

    expect(paths.filter((path) => urls.resolve(path) !== undefined)).toHaveLength(
      MediaResolveLimit + 20,
    )
  })
})
