import type { MediaGateway, MediaPage, MediaQuery, MediaRecord, UploadRequest } from '../types'
import { MediaError } from '../types'

/** What every call answers while the school has nowhere to keep a file. */
const Unavailable = 'media-unavailable'

/**
 * The seat the real gateway will take, refusing every call until it is built.
 *
 * Nothing is wired to this yet: it exists so the swap is a line in the
 * composition root rather than a rewrite of every screen that uploads.
 */
export class HttpMediaGateway implements MediaGateway {
  async upload(_request: UploadRequest): Promise<MediaRecord> {
    throw new MediaError(Unavailable)
  }

  async list(_query: MediaQuery): Promise<MediaPage> {
    throw new MediaError(Unavailable)
  }

  resolve(_url: string): string | undefined {
    return undefined
  }
}
