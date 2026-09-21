import { lookup } from 'node:dns/promises'
import { isIP } from 'node:net'

import { Injectable } from '@nestjs/common'

import { AddressResolverPort } from './ports'

/**
 * A name resolved once, so the addresses the check approved are the addresses
 * the request will reach.
 *
 * A literal address is returned as it stands: there is nothing to look up, and
 * asking a resolver for one is how a refused address slips past a check that
 * only inspects names.
 */
@Injectable()
export class DnsAddressResolver implements AddressResolverPort {
  async resolveAddresses(host: string): Promise<string[]> {
    if (isIP(host)) return [host]

    const found = await lookup(host, { all: true })
    return found.map((entry) => entry.address)
  }
}

/** Where every name answers with the same public address, so a suite can decide. */
@Injectable()
export class FixedAddressResolver implements AddressResolverPort {
  // TEST-NET-3, which is reserved for documentation and routed nowhere.
  private readonly address = '203.0.113.10'

  async resolveAddresses(host: string): Promise<string[]> {
    return isIP(host) ? [host] : [this.address]
  }
}
