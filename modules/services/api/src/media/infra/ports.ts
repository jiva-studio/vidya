import { MediaStoragePort, UploadGrant } from '@vidya/domain'

/**
 * Everything needed to reach one bucket, as a school hands it over.
 *
 * `addresses` is what the endpoint check approved: the dial connects to one of
 * them and never resolves the name a second time, so the host cannot be moved
 * to an address nobody checked between the approval and the request. It is
 * absent for a host we composed ourselves, which is not the school's to
 * re-point and goes through no check to pin.
 */
export type StorageCredentials = {
  endpoint: string
  region: string
  bucket: string
  prefix: string
  accessKeyId: string
  secret: string
  addresses?: string[]
}

/**
 * Opens a port onto one bucket.
 *
 * A factory rather than a single injected port: the credentials belong to the
 * school, not to the installation, so which storage a request talks to is
 * decided per request and cannot be bound at boot.
 */
export interface MediaStorageFactory {
  openStorage(credentials: StorageCredentials): MediaStoragePort
}

/**
 * The only thing in the API that moves bytes, and it moves them by signature.
 *
 * It exists for the probe: proving a school's credentials means writing and
 * reading back through exactly the grant a browser is given, because a probe
 * that used a private path would prove a path nobody uses.
 */
export interface SignedHttpPort {
  writeByGrant(grant: UploadGrant, body: Buffer, addresses?: string[]): Promise<void>
  readRange(url: string, lengthBytes: number, addresses?: string[]): Promise<Buffer>
}

/**
 * Names to addresses, before anything is sent.
 *
 * Injected rather than called because resolution is the step SSRF turns on: it
 * has to happen here, ahead of the request, and a suite has to be able to say
 * what a name resolves to without owning a DNS server.
 */
export interface AddressResolverPort {
  resolveAddresses(host: string): Promise<string[]>
}

export const MEDIA_STORAGE = Symbol('MEDIA_STORAGE')
export const MEDIA_SIGNED_HTTP = Symbol('MEDIA_SIGNED_HTTP')
export const MEDIA_ADDRESS_RESOLVER = Symbol('MEDIA_ADDRESS_RESOLVER')
