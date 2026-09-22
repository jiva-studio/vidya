import type { UploadGrant } from '@vidya/domain'

import type { UploadProgress } from '../types'
import { MediaError } from '../types'

/** What a caller wants to hear about while the bytes are in flight. */
export interface GrantUpload {
  onProgress?: UploadProgress
  signal?: AbortSignal
}

const Failed = 'media-upload-failed'
const Cancelled = 'media-upload-cancelled'

/**
 * Writes the bytes straight into the school's bucket, by the grant alone.
 *
 * `XMLHttpRequest` rather than `fetch`: a request body stream is the only way
 * `fetch` reports how far an upload has got, and no browser ships it for
 * uploads. The grant's headers go out verbatim — the signature covers the
 * declared length and type, so anything added or dropped is refused by storage.
 */
export const putByGrant = (
  grant: UploadGrant,
  file: File,
  { onProgress, signal }: GrantUpload = {},
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    if (grant.method !== 'put') {
      reject(new MediaError(Failed))
      return
    }

    const call = new XMLHttpRequest()
    call.open('PUT', grant.url, true)

    for (const [name, value] of Object.entries(grant.headers)) {
      // The browser sets the length itself and refuses to be told it.
      if (name.toLowerCase() !== 'content-length') call.setRequestHeader(name, value)
    }

    call.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100))
    }

    call.onload = () =>
      call.status >= 200 && call.status < 300 ? resolve() : reject(new MediaError(Failed))
    call.onerror = () => reject(new MediaError(Failed))
    call.onabort = () => reject(new MediaError(Cancelled))

    if (signal) {
      if (signal.aborted) return call.abort()
      signal.addEventListener('abort', () => call.abort(), { once: true })
    }

    onProgress?.(0)
    call.send(file)
  })
