import { LookupAddress } from 'node:dns'
import { isIPv6 } from 'node:net'

type LookupCallback = (
  error: Error | null,
  address: string | LookupAddress[],
  family?: number,
) => void

/** The shape `net.connect` and `http.request` accept in place of `dns.lookup`. */
export type PinnedLookup = (
  hostname: string,
  options: { all?: boolean },
  callback: LookupCallback,
) => void

const familyOf = (address: string): number => (isIPv6(address) ? 6 : 4)

/**
 * Answers every name with the addresses a check already approved.
 *
 * A second resolution is the whole of the hole this closes: between the approval
 * and the request the name's owner can point it at an address that would have
 * been refused, and the connection would be made before anything looked again.
 * Only the connection is pinned — the name still travels in the TLS handshake
 * and the `Host` header, so the certificate is validated against the host the
 * school typed, not against an address.
 */
export const pinnedLookup = (addresses: string[]): PinnedLookup => {
  const answers = addresses.map((address) => ({ address, family: familyOf(address) }))

  return (_hostname, options, callback) => {
    if (answers.length === 0) {
      callback(new Error('No approved address to connect to.'), [])
      return
    }

    if (options.all) {
      callback(null, answers)
      return
    }

    callback(null, answers[0].address, answers[0].family)
  }
}
