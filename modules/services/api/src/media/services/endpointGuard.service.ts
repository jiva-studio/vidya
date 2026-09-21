import { Inject, Injectable } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { MediaConfig } from '@vidya/api/configs'

import { AddressResolverPort, MEDIA_ADDRESS_RESOLVER } from '../infra/ports'
import { StorageFailedError } from '../storageFailure'
import { isPublicAddress } from './addressRanges'

const matchesSuffix = (host: string, suffix: string): boolean =>
  host === suffix || host.endsWith(`.${suffix}`)

/**
 * Decides whether the API will dial an address a school typed in.
 *
 * The school's endpoint is reached from inside our network, which makes it a
 * way to ask us to fetch things only we can reach. Every check therefore runs
 * before the first byte leaves: the scheme, the host against what the
 * installation allows, and then each address the name resolves to — resolved
 * here so that what was approved is what will be dialled.
 */
@Injectable()
export class EndpointGuardService {
  constructor(
    @Inject(MediaConfig.KEY) private readonly config: ConfigType<typeof MediaConfig>,
    @Inject(MEDIA_ADDRESS_RESOLVER) private readonly resolver: AddressResolverPort,
  ) {}

  async assertEndpointAllowed(endpoint: string): Promise<void> {
    const host = this.parseHttpsHost(endpoint)

    if (!this.config.endpointAllowlist.some((suffix) => matchesSuffix(host, suffix))) {
      throw new StorageFailedError('endpoint-rejected')
    }

    const addresses = await this.resolveOrRefuse(host)

    if (addresses.length === 0 || !addresses.every(isPublicAddress)) {
      throw new StorageFailedError('endpoint-rejected')
    }
  }

  private parseHttpsHost(endpoint: string): string {
    try {
      const url = new URL(endpoint)
      if (url.protocol !== 'https:') throw new StorageFailedError('endpoint-rejected')

      return url.hostname.replace(/^\[|\]$/g, '')
    } catch {
      throw new StorageFailedError('endpoint-rejected')
    }
  }

  private async resolveOrRefuse(host: string): Promise<string[]> {
    try {
      return await this.resolver.resolveAddresses(host)
    } catch {
      // A name that does not resolve is not an address we can approve, and
      // refusing it here keeps the outcome the same as any other address we
      // will not dial: nothing was sent.
      throw new StorageFailedError('endpoint-rejected')
    }
  }
}
