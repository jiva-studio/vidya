import { randomUUID } from 'node:crypto'

import { MediaKind, MediaStoragePort } from '@vidya/domain'

import { StorageCredentials } from '../ports'
import { openStandStorage, removeAllUnder, standCredentials, writeByGrant } from './stand'

const BODY = Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>')

/** The headers live storage answers a signed read with, and nothing else. */
const headersOf = async (url: string): Promise<Record<string, string>> => {
  const response = await fetch(url)
  await response.arrayBuffer()

  return Object.fromEntries(response.headers.entries())
}

describe('what a browser is told to do with a signed read on live storage', () => {
  let credentials: StorageCredentials
  let storage: MediaStoragePort

  beforeEach(() => {
    credentials = standCredentials(`storage-spec/${randomUUID()}`)
    storage = openStandStorage(credentials)
  })

  afterEach(async () => {
    await removeAllUnder(storage, credentials.prefix)
  })

  const store = async (name: string, contentType: string, kind: MediaKind): Promise<string> => {
    const key = `${credentials.prefix}/${name}`
    const grant = await storage.signUpload(key, { contentType, sizeBytes: BODY.length })
    const written = await writeByGrant(grant, BODY)

    expect(written.status).toBe(200)

    return (await storage.signRead(key, kind)).url
  }

  it('shows an image in place, which is what a lesson needs of it', async () => {
    const headers = await headersOf(await store('cover.png', 'image/png', 'image'))

    expect(headers['content-disposition']).toMatch(/^inline/)
  })

  it('shows a video in place, so a player can stream it', async () => {
    const headers = await headersOf(await store('lecture.mp4', 'video/mp4', 'video'))

    expect(headers['content-disposition']).toMatch(/^inline/)
  })

  it('hands down anything outside the allowed types as a file to save', async () => {
    const headers = await headersOf(await store('handout.pdf', 'application/pdf', 'image'))

    expect(headers['content-disposition']).toMatch(/^attachment/)
  })

  it('never serves an svg as a document from our own domain', async () => {
    const headers = await headersOf(await store('logo.svg', 'image/svg+xml', 'image'))

    expect(headers['content-disposition']).toMatch(/^attachment/)
    expect(headers['content-type']).not.toBe('image/svg+xml')
  })
})
