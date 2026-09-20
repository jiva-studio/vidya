import type { BlockSource, Id, IsoDateTime } from '@vidya/domain'

/** Minted in the admin and never sent: the server has nowhere to keep a file yet. */
export type MediaId = Id<'Media'>

export type MediaKind = 'image' | 'video' | 'audio'

/**
 * A stored file, as the library lists it and a block refers to it.
 *
 * `url` is what a block stores: a path the server will serve, never a blob url,
 * which would die with the tab that made it.
 */
export interface MediaRecord {
  id: MediaId
  kind: MediaKind
  url: string
  name: string
  sizeBytes: number
  createdAt: IsoDateTime
}

export interface MediaQuery {
  term?: string
  kind?: MediaKind
  page?: number
}

export interface MediaPage {
  items: MediaRecord[]
  total: number
  page: number
  pageSize: number
}

export type UploadProgress = (percent: number) => void

export interface UploadRequest {
  file: File
  onProgress?: UploadProgress
  signal?: AbortSignal
}

/**
 * Everything the editor needs from storage, and the seam the fake stands in.
 *
 * `resolve` exists because a stored `/media/<id>` means nothing to an `img`
 * until something hands back an address for it.
 */
export interface MediaGateway {
  upload(request: UploadRequest): Promise<MediaRecord>
  list(query: MediaQuery): Promise<MediaPage>
  resolve(url: string): string | undefined
}

/** What a picker hands back, whichever way the file was chosen. */
export interface PickedMedia {
  url: string
  source: BlockSource
  name?: string
}

/** Why an upload or a listing failed, as a Fluent key rather than a sentence. */
export class MediaError extends Error {
  constructor(readonly reason: string) {
    super(reason)
    this.name = 'MediaError'
  }
}
