import type { MediaId, SignedUrl } from '@vidya/domain'
import { asId, mediaPath, toIsoDateTime } from '@vidya/domain'
import type { ResolveMediaRequest, ResolveMediaResponse } from '@vidya/protocol'
import { beforeEach, describe, expect, it } from 'vitest'

import type { HttpClient, HttpQuery } from '../../../ports'
import { createMediaUrls } from '../mediaUrls'

const LECTURE = asId<MediaId>('c3d4e5f6-7081-4923-ab4c-5d6e7f809102')

const NOON = Date.parse('2026-09-21T12:00:00.000Z')
const SIX_HOURS = 6 * 3600 * 1000

let now = NOON
let asked: ResolveMediaRequest[] = []
let answers: Record<string, SignedUrl> = {}

const signed = (id: MediaId, expiresAtMs: number): SignedUrl => ({
  url: `https://cdn.school.example/${id}/original`,
  expiresAt: toIsoDateTime(new Date(expiresAtMs)),
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
    asked.push(request)

    const urls = Object.fromEntries(
      request.ids.filter((id) => answers[id] !== undefined).map((id) => [id, answers[id]!]),
    )

    return { urls } as ResolveMediaResponse as TResponse
  },
}

const mediaUrls = () => createMediaUrls({ http, nowMs: () => now })

beforeEach(() => {
  now = NOON
  asked = []
  answers = { [LECTURE]: signed(LECTURE, NOON + SIX_HOURS) }
})

describe('the edge of a signature window', () => {
  it('still answers at the instant the signature names', async () => {
    const urls = mediaUrls()
    await urls.prime([mediaPath(LECTURE)])

    now = NOON + SIX_HOURS

    expect(urls.resolve(mediaPath(LECTURE))).toBe(answers[LECTURE]!.url)
  })

  it('stops answering one millisecond later', async () => {
    const urls = mediaUrls()
    await urls.prime([mediaPath(LECTURE)])

    now = NOON + SIX_HOURS + 1

    expect(urls.resolve(mediaPath(LECTURE))).toBeUndefined()
  })
})

describe('an address the school stops issuing', () => {
  it('forgets the one it held when the next batch answers without it', async () => {
    const urls = mediaUrls()
    await urls.prime([mediaPath(LECTURE)])

    answers = {}
    await urls.prime([mediaPath(LECTURE)])

    expect(urls.resolve(mediaPath(LECTURE))).toBeUndefined()
  })
})

describe('what reaches the school in one batch', () => {
  it('names a file asked for twice only once', async () => {
    const urls = mediaUrls()
    await urls.prime([mediaPath(LECTURE), mediaPath(LECTURE)])

    expect(asked[0]!.ids).toEqual([LECTURE])
  })

  it('asks nothing for a path that names no file of the school', async () => {
    const urls = mediaUrls()
    await urls.prime(['/media/not-an-id', 'https://archive.example.org/talks/1.mp4'])

    expect(asked).toEqual([])
  })
})
