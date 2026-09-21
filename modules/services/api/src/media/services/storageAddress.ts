import { StorageProvider } from '@vidya/domain'

import { StorageFailedError } from '../storageFailure'

/** What a school supplied about where its bucket is. */
export type StorageAddressAsk = {
  region: string
  r2AccountId?: string | null
  endpoint?: string | null
}

const LABEL = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$/

const label = (value: string | null | undefined): string => {
  if (!value || !LABEL.test(value)) throw new StorageFailedError('endpoint-rejected')

  return value
}

/**
 * The address of each provider we drive, one builder apiece.
 *
 * A school picks a provider and types keys, never a URL: the host is ours to
 * compose from the region or the account, which is what keeps three of these
 * four off the SSRF allowlist entirely — the name they resolve to is one we
 * wrote. `s3-compatible` is the exception and the reason the allowlist exists.
 */
const addressBuilders: Record<StorageProvider, (ask: StorageAddressAsk) => string> = {
  aws: (ask) => `https://s3.${label(ask.region)}.amazonaws.com`,
  bunny: (ask) => `https://${label(ask.region)}-s3.storage.bunnycdn.com`,
  r2: (ask) => `https://${label(ask.r2AccountId)}.r2.cloudflarestorage.com`,
  's3-compatible': (ask) => {
    if (!ask.endpoint) throw new StorageFailedError('endpoint-rejected')

    return ask.endpoint
  },
}

/** Whether the address is the school's to type, and therefore ours to police. */
export const hasOwnEndpoint = (provider: StorageProvider): boolean => provider === 's3-compatible'

/**
 * The address a profile is dialled at, refused when what arrived cannot name
 * one.
 *
 * A provider is given no say beyond the piece its own host is built from: an
 * endpoint supplied beside a named provider is refused rather than ignored,
 * because accepting it silently would let a school aim `aws` at an address of
 * its choosing and be told the keys were proved against Amazon. An account
 * supplied beside a provider that is not R2 is refused for the same reason —
 * it would mean the school and the profile disagree about which host was
 * dialled.
 */
export const storageEndpointFor = (provider: StorageProvider, ask: StorageAddressAsk): string => {
  if (!hasOwnEndpoint(provider) && ask.endpoint) throw new StorageFailedError('endpoint-rejected')
  if (provider !== 'r2' && ask.r2AccountId) throw new StorageFailedError('endpoint-rejected')

  return addressBuilders[provider](ask)
}
