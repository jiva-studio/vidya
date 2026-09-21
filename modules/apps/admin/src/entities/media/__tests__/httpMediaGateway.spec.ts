import { Routes } from '@vidya/protocol'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { fakeHttpClient, signInAs } from '@/shared/testing'

import { HttpMediaGateway } from '../api'

const STORED = '/media/00000000-0000-4000-8000-000000000001'
const SECOND = '/media/00000000-0000-4000-8000-000000000002'
const SIGNED = 'https://cdn.test/one.png?sig=1'

const idOf = (path: string) => path.slice('/media/'.length)

/** What the server answers a batch with: the ones this caller may read. */
const addresses = (paths: string[]) => ({
  urls: Object.fromEntries(
    paths.map((path) => [idOf(path), { url: SIGNED, expiresAt: '2026-09-21T13:00:00.000Z' }]),
  ),
})

/** An upload that reports its progress and answers 200, without a socket. */
const fakeXhr = () => {
  const sent: { url: string; headers: Record<string, string> }[] = []

  class Upload {
    onprogress: ((event: ProgressEvent) => void) | null = null
  }

  class Call {
    readonly upload = new Upload()
    status = 200
    onload: (() => void) | null = null
    onerror: (() => void) | null = null
    onabort: (() => void) | null = null

    private url = ''
    private readonly headers: Record<string, string> = {}

    open(_method: string, url: string) {
      this.url = url
    }

    setRequestHeader(name: string, value: string) {
      this.headers[name] = value
    }

    send() {
      sent.push({ url: this.url, headers: this.headers })
      this.upload.onprogress?.({ lengthComputable: true, loaded: 5, total: 10 } as ProgressEvent)
      this.onload?.()
    }

    abort() {
      this.onabort?.()
    }
  }

  vi.stubGlobal('XMLHttpRequest', Call)
  return sent
}

const grant = () => ({
  method: 'put' as const,
  url: 'memory://bucket/school/one/image/file.png',
  headers: { 'Content-Type': 'image/png', 'Content-Length': '64' },
  fields: {},
  expiresAt: '2026-09-21T13:00:00.000Z',
})

const file = () => new File(['x'.repeat(64)], 'Chart.png', { type: 'image/png' })

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('asking the server for addresses', () => {
  it('asks for a whole screen in one call and answers from what came back', async () => {
    const { client, callsTo } = fakeHttpClient({
      [`POST ${Routes().media.urls()}`]: addresses([STORED, SECOND]),
    })
    const gateway = new HttpMediaGateway(client)

    await gateway.prime([STORED, SECOND, STORED])

    expect(callsTo(Routes().media.urls())).toHaveLength(1)
    expect(callsTo(Routes().media.urls())[0].body).toEqual({
      ids: [idOf(STORED), idOf(SECOND)],
    })
    expect(gateway.resolve(STORED)).toBe(SIGNED)
  })

  it('leaves out of its hands what the answer left out', async () => {
    const { client } = fakeHttpClient({
      [`POST ${Routes().media.urls()}`]: addresses([STORED]),
    })
    const gateway = new HttpMediaGateway(client)

    await gateway.prime([STORED, SECOND])

    expect(gateway.resolve(SECOND)).toBeUndefined()
  })

  it('asks nothing when no path among them names a stored file', async () => {
    const { client, calls } = fakeHttpClient({})
    const gateway = new HttpMediaGateway(client)

    await gateway.prime(['https://example.test/clip.mp4'])

    expect(calls).toEqual([])
  })

  it('hands an address that is not ours straight back', async () => {
    const gateway = new HttpMediaGateway(fakeHttpClient({}).client)

    expect(gateway.resolve('https://example.test/clip.mp4')).toBe('https://example.test/clip.mp4')
  })
})

describe('uploading a file', () => {
  beforeEach(() => {
    signInAs(['media:upload'])
  })

  it('declares it, writes it by the grant, and then says it landed', async () => {
    const sent = fakeXhr()
    const mediaId = idOf(STORED)
    const { client, calls } = fakeHttpClient({
      [`POST ${Routes().media.uploads()}`]: { mediaId, grant: grant(), deduplicated: false },
      [`POST ${Routes().media.complete(mediaId)}`]: {
        id: mediaId,
        kind: 'image',
        url: STORED,
        name: 'Chart.png',
        sizeBytes: 64,
        createdAt: '2026-09-21T09:00:00.000Z',
      },
    })

    const progress: number[] = []
    const record = await new HttpMediaGateway(client).upload({
      file: file(),
      onProgress: (percent) => progress.push(percent),
    })

    expect(calls.map((call) => call.path)).toEqual([
      Routes().media.uploads(),
      Routes().media.complete(mediaId),
    ])
    expect(sent.map((write) => write.url)).toEqual([grant().url])
    expect(progress).toEqual([0, 50])
    expect(record.url).toBe(STORED)
  })

  it('never tells the browser the length, which it refuses to be told', async () => {
    const sent = fakeXhr()
    const mediaId = idOf(STORED)
    const { client } = fakeHttpClient({
      [`POST ${Routes().media.uploads()}`]: { mediaId, grant: grant(), deduplicated: false },
      [`POST ${Routes().media.complete(mediaId)}`]: {
        id: mediaId,
        kind: 'image',
        url: STORED,
        name: 'Chart.png',
        sizeBytes: 64,
        createdAt: '2026-09-21T09:00:00.000Z',
      },
    })

    await new HttpMediaGateway(client).upload({ file: file() })

    expect(Object.keys(sent[0].headers)).toEqual(['Content-Type'])
  })
})
