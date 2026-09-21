import { connect } from 'node:net'

import { S3Client } from '@aws-sdk/client-s3'
import { MediaStoragePort, UploadGrant } from '@vidya/domain'

import { S3StorageFactory } from '../s3Storage'
import { StorageCredentials } from '../ports'

/**
 * The stand's MinIO, with the same defaults the runner probes before it starts
 * these suites. A suite that talks to storage has no fallback: pointing the
 * variables somewhere else changes which server answers, never whether one has
 * to.
 */
export const standCredentials = (prefix: string): StorageCredentials => ({
  endpoint: process.env.VIDYA_MEDIA_DEFAULT_ENDPOINT ?? 'http://127.0.0.1:7804',
  region: process.env.VIDYA_MEDIA_DEFAULT_REGION ?? 'us-east-1',
  bucket: process.env.VIDYA_MEDIA_DEFAULT_BUCKET ?? 'vidya-media',
  prefix,
  accessKeyId: process.env.VIDYA_MEDIA_DEFAULT_ACCESS_KEY_ID ?? 'vidya',
  secret: process.env.VIDYA_MEDIA_DEFAULT_SECRET ?? 'vidya-dev-secret',
})

export const openStandStorage = (credentials: StorageCredentials): MediaStoragePort =>
  new S3StorageFactory().openStorage(credentials)

/** A raw client, for arranging what the port itself cannot create. */
export const standClient = (credentials: StorageCredentials): S3Client =>
  new S3Client({
    endpoint: credentials.endpoint,
    region: credentials.region,
    credentials: { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secret },
    forcePathStyle: true,
  })

export type Answer = { status: number; headers: Record<string, string>; body: Buffer }

/**
 * Writes bytes through a grant the way a browser does: the grant's headers
 * verbatim, no redirects, nothing added.
 */
export const writeByGrant = async (
  grant: UploadGrant,
  body: Buffer,
  overrides: Record<string, string> = {},
): Promise<Answer> => {
  const headers = { ...grant.headers, ...overrides }
  const response = await fetch(grant.url, { method: 'PUT', headers, body, redirect: 'error' })

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: Buffer.from(await response.arrayBuffer()),
  }
}

export const readRange = async (url: string, first: number, last: number): Promise<Answer> => {
  const response = await fetch(url, { headers: { Range: `bytes=${first}-${last}` } })

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers.entries()),
    body: Buffer.from(await response.arrayBuffer()),
  }
}

const answerOf = (raw: Buffer): Answer => {
  const split = raw.indexOf('\r\n\r\n')
  const head = raw.subarray(0, split < 0 ? raw.length : split).toString('latin1').split('\r\n')
  const status = Number(head[0]?.split(' ')[1] ?? 0)

  const headers = Object.fromEntries(
    head.slice(1).map((line) => {
      const at = line.indexOf(':')
      return [line.slice(0, at).toLowerCase(), line.slice(at + 1).trim()]
    }),
  )

  return { status, headers, body: split < 0 ? Buffer.alloc(0) : raw.subarray(split + 4) }
}

/**
 * Writes bytes over a socket, declaring by default the length actually sent.
 *
 * Spoken over a socket rather than through `fetch`, which refuses to send a
 * body whose length disagrees with the header. The default is what a browser
 * does — `Content-Length` is derived from the body, and a body of the wrong
 * size therefore arrives under a header the signature does not cover. Passing
 * `Content-Length` in `override` sends the other half of the question: a client
 * that claims one length and sends another.
 */
export const writeRawByGrant = async (
  grant: UploadGrant,
  body: Buffer,
  override: Record<string, string> = {},
): Promise<Answer> =>
  new Promise<Answer>((resolve, reject) => {
    const url = new URL(grant.url)
    const headers = { ...grant.headers, 'Content-Length': String(body.length), ...override }
    const lines = Object.entries(headers).map(([name, value]) => `${name}: ${value}`)

    const socket = connect({ host: url.hostname, port: Number(url.port || 80) }, () => {
      socket.write(
        [`PUT ${url.pathname}${url.search} HTTP/1.1`, `Host: ${url.host}`, ...lines, '', ''].join(
          '\r\n',
        ),
      )
      socket.write(body)
    })

    const chunks: Buffer[] = []

    socket.setTimeout(15_000, () => {
      socket.destroy()
      // A body shorter than a declared length leaves storage waiting for the
      // rest rather than answering, and the silence is an answer a caller has
      // to be able to assert on.
      reject(new Error('storage never answered the request'))
    })

    socket.on('data', (chunk: Buffer) => {
      chunks.push(chunk)
      if (Buffer.concat(chunks).includes('\r\n\r\n')) {
        socket.end()
        resolve(answerOf(Buffer.concat(chunks)))
      }
    })

    socket.on('error', reject)
  })

export const removeAllUnder = async (
  storage: MediaStoragePort,
  prefix: string,
): Promise<void> => {
  for await (const found of storage.listPrefix(prefix)) await storage.remove(found.key)
  for await (const session of storage.listUnfinished(prefix)) {
    await storage.abortUnfinished(session.key, session.uploadId)
  }
}
