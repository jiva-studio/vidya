import type { MediaId, SchoolId } from '@vidya/domain'
import { mediaPath, MediaPathPrefix, parseMediaPath } from '@vidya/domain'
import type {
  CompleteUploadResponse,
  CreateUploadRequest,
  CreateUploadResponse,
  GetMediaResponse,
  MediaSummary,
  ResolveMediaRequest,
  ResolveMediaResponse,
} from '@vidya/protocol'
import { Routes } from '@vidya/protocol'

import { useCurrentSchool } from '@/shared/access'
import type { HttpClient } from '@/shared/api'
import { HttpError } from '@/shared/api'

import type {
  MediaGateway,
  MediaKind,
  MediaPage,
  MediaQuery,
  MediaRecord,
  UploadRequest,
} from '../types'
import { MediaError } from '../types'
import { putByGrant } from './putByGrant'

const Unavailable = 'media-unavailable'

const detectKind = (mimeType: string): MediaKind => {
  if (mimeType.startsWith('video/')) return 'video'
  if (mimeType.startsWith('audio/')) return 'audio'
  return 'image'
}

const toRecord = (listed: MediaSummary): MediaRecord => ({
  id: listed.id,
  kind: listed.kind,
  url: listed.url,
  name: listed.name,
  sizeBytes: listed.sizeBytes,
  createdAt: listed.createdAt,
})

/**
 * The reason the server gave, as a key a screen can show.
 *
 * The API answers a refused upload with one of its own message keys, so it is
 * passed through; anything else — a timeout, a 500, an offline browser — is the
 * generic failure, because a status code is not something to put on screen.
 */
const reasonOf = (failure: unknown, fallback: string): MediaError => {
  if (failure instanceof MediaError) return failure

  const reason = failure instanceof HttpError ? failure.reason : undefined
  return new MediaError(reason?.startsWith('media-') ? reason : fallback)
}

/**
 * Storage over HTTP: the library, the three-step upload, and the addresses.
 *
 * `resolve` is synchronous and answers from what `prime` put in hand, because
 * an `img` cannot wait for a promise: a screen asks for everything it is about
 * to draw in one call and then draws it. Nothing is signed twice for one
 * window — the server rounds every expiry to the window boundary, so the
 * address a second screen is given is byte for byte the one already held.
 */
export class HttpMediaGateway implements MediaGateway {
  private readonly signed = new Map<string, string>()

  constructor(private readonly http: HttpClient) {}

  async prime(urls: string[]): Promise<void> {
    const ids = [...new Set(urls)]
      .map(parseMediaPath)
      .filter((id): id is MediaId => id !== undefined)

    if (ids.length === 0) return

    const answer = await this.http.post<ResolveMediaResponse>(Routes().media.urls(), {
      ids,
    } satisfies ResolveMediaRequest)

    for (const [id, address] of Object.entries(answer.urls ?? {})) {
      this.signed.set(mediaPath(id as MediaId), address.url)
    }
  }

  /**
   * An address something can load, or nothing when this screen never primed
   * it. A stored path that was not asked for is not an error: it is what every
   * `/media/<id>` is before the batch that covers it has answered.
   */
  resolve(url: string): string | undefined {
    const target = url.trim()
    if (!target) return undefined
    if (!target.startsWith(MediaPathPrefix)) return target

    return this.signed.get(target)
  }

  async list(query: MediaQuery): Promise<MediaPage> {
    try {
      const page = await this.http.get<GetMediaResponse>(Routes().media.find(), {
        schoolId: this.schoolId(),
        term: query.term || undefined,
        kind: query.kind,
        page: query.page,
      })

      return { ...page, items: page.items.map(toRecord) }
    } catch (failure) {
      throw reasonOf(failure, Unavailable)
    }
  }

  /**
   * Declare, write, confirm — one call from the caller's side.
   *
   * The bytes never pass through the API: it signs a grant, the browser writes
   * straight into the school's bucket, and the third step is what makes the
   * server believe storage rather than the browser about what landed.
   */
  async upload(request: UploadRequest): Promise<MediaRecord> {
    const { file, onProgress, signal } = request

    try {
      const granted = await this.http.post<CreateUploadResponse>(Routes().media.uploads(), {
        schoolId: this.schoolId(),
        kind: detectKind(file.type),
        name: file.name,
        mimeType: file.type,
        sizeBytes: file.size,
      } satisfies CreateUploadRequest)

      await putByGrant(granted.grant, file, { onProgress, signal })

      const stored = await this.http.post<CompleteUploadResponse>(
        Routes().media.complete(granted.mediaId),
        {},
      )

      return toRecord(stored)
    } catch (failure) {
      throw reasonOf(failure, 'media-upload-failed')
    }
  }

  private schoolId(): SchoolId {
    const { schoolId } = useCurrentSchool()
    if (!schoolId.value) throw new MediaError(Unavailable)

    return schoolId.value
  }
}
