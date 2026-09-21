import type { HttpClient, HttpQuery } from '@vidya/client'
import type { MediaId, SignedUrl } from '@vidya/domain'
import { asId, mediaPath, toIsoDateTime } from '@vidya/domain'
import type { ResolveMediaRequest, ResolveMediaResponse } from '@vidya/protocol'
import { Routes } from '@vidya/protocol'
import { beforeEach, describe, expect, it } from 'vitest'

/**
 * The shape the resolver is expected to have, declared here because the port
 * does not exist yet: a screen draws before a promise can answer, so reading an
 * address is synchronous and only filling the cache is not.
 */
interface MediaUrls {
  prime(paths: readonly string[]): Promise<void>
  resolve(path: string): string | undefined
}

type MediaUrlsFactory = (options: { http: HttpClient; nowMs: () => number }) => MediaUrls

const loadMediaUrls = async (): Promise<MediaUrlsFactory> => {
  const exports = (await import('@vidya/client')) as unknown as Record<string, unknown>
  const factory = exports.createMediaUrls

  if (typeof factory !== 'function') {
    throw new Error('@vidya/client exports no createMediaUrls')
  }

  return factory as MediaUrlsFactory
}

/* -------------------------------------------------------------------------- */
/*                                  The world                                 */
/* -------------------------------------------------------------------------- */

const LECTURE = asId<MediaId>('c3d4e5f6-7081-4923-ab4c-5d6e7f809102')
const CHANT = asId<MediaId>('b2c3d4e5-6f70-4812-9a3b-4c5d6e7f8091')
const FORBIDDEN = asId<MediaId>('d4e5f607-1829-4a34-bc5d-6e7f80910213')

const EMBED = 'https://www.youtube.com/embed/abcdef12345'

const NOON = Date.parse('2026-09-21T12:00:00.000Z')
const SIX_HOURS = 6 * 3600 * 1000

let now = NOON

/** Every batch the resolver asked for, in the order it asked. */
let asked: ResolveMediaRequest[] = []

/** What the server answers, keyed by media id; an id absent is a refused read. */
let answers: Record<string, SignedUrl> = {}

const signed = (id: MediaId, expiresAtMs: number, tag = 'v1'): SignedUrl => ({
  url: `https://cdn.school.example/${id}/original?token=${tag}`,
  expiresAt: toIsoDateTime(new Date(expiresAtMs)),
})

const refusing = (): never => {
  throw new Error('the resolver may only ask for a batch of addresses')
}

const http: HttpClient = {
  get: <TResponse>(_path: string, _query?: HttpQuery): Promise<TResponse> => refusing(),
  patch: <TResponse>(_path: string, _body?: unknown): Promise<TResponse> => refusing(),
  delete: (_path: string): Promise<void> => refusing(),
  post: async <TResponse>(path: string, body?: unknown): Promise<TResponse> => {
    if (path !== Routes().media.urls()) refusing()
    asked.push(body as ResolveMediaRequest)

    const request = body as ResolveMediaRequest
    const urls = Object.fromEntries(
      request.ids.filter((id) => answers[id] !== undefined).map((id) => [id, answers[id]!]),
    )

    return { urls } as ResolveMediaResponse as TResponse
  },
}

const mediaUrls = async (): Promise<MediaUrls> => (await loadMediaUrls())({ http, nowMs: () => now })

beforeEach(() => {
  now = NOON
  asked = []
  answers = {
    [LECTURE]: signed(LECTURE, NOON + SIX_HOURS),
    [CHANT]: signed(CHANT, NOON + SIX_HOURS),
  }
})

/**
 * A block stores `/media/<id>`, which is a name and not an address.
 *
 * The address is issued per read and belongs to the screen that is about to
 * draw, so the resolver asks for a whole screen at once and then answers from
 * memory. What it cannot answer is said by answering nothing: an address that
 * is missing is a file this reader may not have, and a screen explains that
 * instead of handing a player a broken source.
 */
describe('resolving the address of a school file', () => {
  it('knows no address for a stored path before a screen has asked for one', async () => {
    const urls = await mediaUrls()

    expect(urls.resolve(mediaPath(LECTURE))).toBeUndefined()
  })

  it('answers a primed path with the address the school signed', async () => {
    const urls = await mediaUrls()
    await urls.prime([mediaPath(LECTURE)])

    expect(urls.resolve(mediaPath(LECTURE))).toBe(answers[LECTURE]!.url)
  })

  it('asks for a whole screen in one request', async () => {
    const urls = await mediaUrls()
    await urls.prime([mediaPath(LECTURE), mediaPath(CHANT)])

    expect(asked).toHaveLength(1)
    expect(asked[0]!.ids.slice().sort()).toEqual([CHANT, LECTURE].slice().sort())
  })

  it('leaves a path the school gave no address for unresolved, without failing', async () => {
    const urls = await mediaUrls()
    await urls.prime([mediaPath(FORBIDDEN), mediaPath(LECTURE)])

    expect(urls.resolve(mediaPath(FORBIDDEN))).toBeUndefined()
    expect(urls.resolve(mediaPath(LECTURE))).toBe(answers[LECTURE]!.url)
  })

  it('carries an external address through untouched', async () => {
    const urls = await mediaUrls()

    expect(urls.resolve(EMBED)).toBe(EMBED)
  })

  it('needs neither a priming nor a request for an external address', async () => {
    const urls = await mediaUrls()
    await urls.prime([EMBED])

    expect(urls.resolve(EMBED)).toBe(EMBED)
    expect(asked.flatMap((request) => request.ids)).toEqual([])
  })
})

/**
 * A signature dies before the lecture does.
 *
 * A player handed an expired address gets a 403 on the range request in the
 * middle of playback and has no way to ask for another, so an address whose
 * window has closed is not an address any more.
 */
describe('an address that has stopped working', () => {
  it('stops answering a path whose signature has expired', async () => {
    const urls = await mediaUrls()
    await urls.prime([mediaPath(LECTURE)])

    now = NOON + SIX_HOURS + 1

    expect(urls.resolve(mediaPath(LECTURE))).toBeUndefined()
  })

  it('answers with the fresh address after a second priming', async () => {
    const urls = await mediaUrls()
    await urls.prime([mediaPath(LECTURE)])

    now = NOON + SIX_HOURS + 1
    answers[LECTURE] = signed(LECTURE, now + SIX_HOURS, 'v2')
    await urls.prime([mediaPath(LECTURE)])

    expect(urls.resolve(mediaPath(LECTURE))).toBe(answers[LECTURE]!.url)
  })

  it('replaces the address it held rather than keeping the older one', async () => {
    const urls = await mediaUrls()
    await urls.prime([mediaPath(LECTURE)])

    const first = answers[LECTURE]!.url
    answers[LECTURE] = signed(LECTURE, NOON + SIX_HOURS, 'v2')
    await urls.prime([mediaPath(LECTURE)])

    expect(urls.resolve(mediaPath(LECTURE))).not.toBe(first)
  })
})
