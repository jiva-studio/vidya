import { Injectable } from '@nestjs/common'
import { UploadGrant } from '@vidya/domain'

import { StorageFailedError } from '../storageFailure'
import { SignedHttpPort } from './ports'

/** The statuses that mean the address answered and turned the credentials away. */
const REJECTED = new Set([401, 403])

/**
 * Bytes moved by signature, and nothing else.
 *
 * Redirects are refused rather than followed: the address was checked before
 * anything was sent, and a redirect is an invitation to send it somewhere that
 * was not.
 */
@Injectable()
export class FetchSignedHttp implements SignedHttpPort {
  async writeByGrant(grant: UploadGrant, body: Buffer): Promise<void> {
    await this.send(grant.url, { method: 'PUT', headers: { ...grant.headers }, body })
  }

  async readRange(url: string, lengthBytes: number): Promise<Buffer> {
    const response = await this.send(url, {
      method: 'GET',
      headers: { Range: `bytes=0-${Math.max(lengthBytes - 1, 0)}` },
    })

    return Buffer.from(await response.arrayBuffer())
  }

  private async send(url: string, init: RequestInit): Promise<Response> {
    let response: Response

    try {
      response = await fetch(url, { ...init, redirect: 'error' })
    } catch {
      // A refused redirect lands here too, and it is the same answer: the
      // address we checked did not serve the request itself.
      throw new StorageFailedError('unreachable')
    }

    if (REJECTED.has(response.status)) throw new StorageFailedError('credentials-rejected')
    if (!response.ok) throw new StorageFailedError('unreachable')

    return response
  }
}
