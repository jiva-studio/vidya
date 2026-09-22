import { request as httpRequest } from 'node:http'
import { request as httpsRequest } from 'node:https'

import { Injectable } from '@nestjs/common'
import { UploadGrant } from '@vidya/domain'

import { StorageFailedError } from '../storageFailure'
import { pinnedLookup } from './pinnedAddresses'
import { SignedHttpPort } from './ports'

/** The statuses that mean the address answered and turned the credentials away. */
const REJECTED = new Set([401, 403])

type Answer = { status: number; body: Buffer }

type Ask = {
  method: 'PUT' | 'GET'
  headers: Record<string, string>
  body?: Buffer
  addresses?: string[]
}

/**
 * Bytes moved by signature, and nothing else.
 *
 * Redirects are refused rather than followed: the address was checked before
 * anything was sent, and a redirect is an invitation to send it somewhere that
 * was not. For the same reason the connection goes to the addresses the check
 * approved where it approved any — `node:http` is used rather than `fetch`
 * because it takes a resolver, and a request that resolves the host itself is
 * a request nobody checked the destination of.
 */
@Injectable()
export class FetchSignedHttp implements SignedHttpPort {
  async writeByGrant(grant: UploadGrant, body: Buffer, addresses?: string[]): Promise<void> {
    await this.send(grant.url, { method: 'PUT', headers: { ...grant.headers }, body, addresses })
  }

  async readRange(url: string, lengthBytes: number, addresses?: string[]): Promise<Buffer> {
    const answer = await this.send(url, {
      method: 'GET',
      headers: { Range: `bytes=0-${Math.max(lengthBytes - 1, 0)}` },
      addresses,
    })

    return answer.body
  }

  private async send(url: string, ask: Ask): Promise<Answer> {
    let answer: Answer

    try {
      answer = await this.exchange(url, ask)
    } catch {
      // A name that will not connect lands here, and it is the same answer as a
      // server that refused the socket: the address did not serve the request.
      throw new StorageFailedError('unreachable')
    }

    if (REJECTED.has(answer.status)) throw new StorageFailedError('credentials-rejected')
    if (answer.status < 200 || answer.status > 299) throw new StorageFailedError('unreachable')

    return answer
  }

  private async exchange(url: string, ask: Ask): Promise<Answer> {
    const target = new URL(url)
    const send = target.protocol === 'https:' ? httpsRequest : httpRequest
    const lookup = ask.addresses?.length ? pinnedLookup(ask.addresses) : undefined

    return new Promise<Answer>((resolve, reject) => {
      const outgoing = send(
        target,
        { method: ask.method, headers: ask.headers, lookup },
        (answer) => {
          const chunks: Buffer[] = []

          answer.on('data', (chunk: Buffer) => chunks.push(chunk))
          answer.on('error', reject)
          answer.on('end', () =>
            resolve({ status: answer.statusCode ?? 0, body: Buffer.concat(chunks) }),
          )
        },
      )

      outgoing.on('error', reject)
      outgoing.end(ask.body)
    })
  }
}
