import { StorageDelivery } from '@vidya/domain'

import { StorageFailedError } from '../storageFailure'

/**
 * Why no profile signs a stream, said differently depending on which one asked.
 *
 * A player fetches a manifest and then hundreds of segments by relative path,
 * so a signature covering one object cannot carry a stream: a bucket signed by
 * its own endpoint has nothing to sign a catalogue with, and says so with a key
 * a screen can show. A CDN in front of the bucket can sign one, and that
 * signing arrives with the provider rather than here.
 */
export const refuseStreamSigning = (delivery?: StorageDelivery): never => {
  if (delivery === 'presigned') {
    throw new StorageFailedError('stream-unsupported')
  }

  throw new Error(
    'A stream delivered through a CDN is signed by the stream provider, not by object storage',
  )
}
