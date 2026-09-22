import { Clock } from '@vidya/api/shared/clock'
import { MediaKind } from '@vidya/domain'

import { acceptedCredentials } from '../fixtureCredentials'
import { StorageCredentials } from '../ports'
import { S3StorageFactory } from '../s3Storage'

const credentials = (): StorageCredentials => ({
  endpoint: 'https://storage.invalid',
  region: 'us-east-1',
  bucket: 'vidya-demo',
  prefix: 'school/one',
  ...acceptedCredentials(),
})

const NOON = Date.UTC(2026, 8, 21, 12, 17, 43, 512)

const fixed = (nowMs: number): Clock => ({ nowMs: () => nowMs })

/** What the signature tells storage to answer with, as the query string holds it. */
const answeredWith = async (key: string, kind: MediaKind, mimeType?: string) => {
  const signed = await new S3StorageFactory(fixed(NOON))
    .openStorage(credentials())
    .signRead(key, kind, mimeType)
  const query = new URL(signed.url).searchParams

  return {
    disposition: query.get('response-content-disposition'),
    contentType: query.get('response-content-type'),
  }
}

describe('what a signed read tells the browser to do with the bytes', () => {
  it('shows a type the school was allowed to upload in place', async () => {
    const answer = await answeredWith('school/one/image/f/original.png', 'image', 'image/png')

    expect(answer.disposition).toBe('inline')
    expect(answer.contentType).toBe('image/png')
  })

  it('hands down a type nobody may be shown, and strips the type with it', async () => {
    const answer = await answeredWith('school/one/image/f/original.bin', 'image', 'image/svg+xml')

    expect(answer.disposition).toBe('attachment')
    expect(answer.contentType).toBe('application/octet-stream')
  })

  it('believes the type the row recorded over the extension of the key', async () => {
    const answer = await answeredWith('school/one/image/f/original.png', 'image', 'image/svg+xml')

    expect(answer.disposition).toBe('attachment')
    expect(answer.contentType).toBe('application/octet-stream')
  })

  it('hands down a file whose type belongs to another kind than the one asked for', async () => {
    const answer = await answeredWith('school/one/image/f/original.mp4', 'image', 'video/mp4')

    expect(answer.disposition).toBe('attachment')
  })

  it("falls back to what the key's own extension names, for a caller holding no row", async () => {
    const shown = await answeredWith('school/one/video/f/original.mp4', 'video')
    const saved = await answeredWith('school/one/image/f/handout.pdf', 'image')

    expect(shown.disposition).toBe('inline')
    expect(saved.disposition).toBe('attachment')
  })
})
