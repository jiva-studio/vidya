import { mediaPath, toIsoDateTime } from '@vidya/domain'
import { Media } from '@vidya/entities'
import * as protocol from '@vidya/protocol'

/**
 * The summary a gallery draws, and nothing beside it.
 *
 * The keys are exactly the contract's: a field added here that the fixture does
 * not carry reaches a client that has no place to put it, and one dropped
 * leaves a gallery cell blank.
 */
export const toMediaSummary = (media: Media): protocol.MediaSummary => ({
  id: media.id,
  kind: media.kind,
  status: media.status,
  url: mediaPath(media.id),
  name: media.name,
  mimeType: media.mimeType,
  sizeBytes: Number(media.sizeBytes),
  createdAt: toIsoDateTime(media.createdAt),
})

/**
 * The file as a lesson block and an editor see it.
 *
 * What is unknown is absent rather than null: a present key with no value reads
 * as a file whose dimensions are broken instead of one whose dimensions were
 * never measured.
 */
export const toMediaRecord = (media: Media): protocol.MediaRecord => ({
  ...toMediaSummary(media),
  schoolId: media.schoolId,
  ...(media.sha256 ? { sha256: media.sha256 } : {}),
  ...(media.width === null ? {} : { width: media.width }),
  ...(media.height === null ? {} : { height: media.height }),
  ...(media.durationMs === null ? {} : { durationMs: media.durationMs }),
  ...(media.posterMediaId ? { posterMediaId: media.posterMediaId } : {}),
})
