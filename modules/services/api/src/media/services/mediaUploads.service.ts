import { randomUUID } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { MediaConfig } from '@vidya/api/configs'
import { toMediaRecord } from '@vidya/api/media/mappers'
import { MediaId, StoredObject, UserId } from '@vidya/domain'
import { Media, StorageProfile } from '@vidya/entities'
import * as protocol from '@vidya/protocol'

import { MediaRefusedError } from '../mediaRefusal'
import { isAllowedMimeType, maxBytesOf, prefixOf, storageKeyOf } from './mediaLimits'
import { ConfirmedObject, isDigestCollision, MediaRowsService } from './mediaRows.service'
import { MediaUsageService } from './mediaUsage.service'
import { SchoolStorage, SchoolStorageService } from './schoolStorage.service'
import { quotaBytesFor, StorageQuotasService } from './storageQuotas.service'

/**
 * Signing one upload and believing storage about what landed.
 *
 * Nothing the client says about the bytes survives this service: the size, the
 * type and the digest it declares bind the signature, and what the row ends up
 * holding is what storage reports about the object — a row whose object turns
 * out to be something else is failed rather than corrected. The quota is
 * refused here, at the signature, because refusing it after two gigabytes have
 * been uploaded is not a refusal anybody can act on.
 */
@Injectable()
export class MediaUploadsService {
  constructor(
    @Inject(MediaConfig.KEY) private readonly config: ConfigType<typeof MediaConfig>,
    private readonly quotas: StorageQuotasService,
    private readonly rows: MediaRowsService,
    private readonly storages: SchoolStorageService,
    private readonly usage: MediaUsageService,
  ) {}

  async findMedia(mediaId: MediaId): Promise<Media | null> {
    return this.rows.findById(mediaId)
  }

  async signUpload(
    request: protocol.CreateUploadRequest,
    createdBy: UserId,
  ): Promise<protocol.CreateUploadResponse> {
    this.assertUploadable(request)

    const opened = await this.storages.openCurrent(request.schoolId)

    const mediaId = randomUUID() as MediaId
    const storageKey = storageKeyOf(
      prefixOf(opened.profile),
      request.kind,
      mediaId,
      request.mimeType,
    )

    const reserved = await this.rows.createPending({
      id: mediaId,
      schoolId: request.schoolId,
      profileId: opened.profile.id,
      kind: request.kind,
      storageKey,
      name: request.name,
      mimeType: request.mimeType,
      sizeBytes: request.sizeBytes,
      createdBy,
    })

    await this.assertRoomFor(reserved, opened.profile)

    const deduplicated = this.isDeduplicated(request)

    return {
      mediaId,
      deduplicated,
      grant: await opened.storage.signUpload(storageKey, {
        contentType: request.mimeType,
        sizeBytes: request.sizeBytes,
        sha256: deduplicated ? request.sha256 : undefined,
      }),
    }
  }

  /**
   * The digest a completion declares is not read: the only digest worth
   * recording is one storage verified against the bytes it accepted, and
   * hashing the object ourselves would mean moving every uploaded byte through
   * this process.
   */
  async completeUpload(media: Media, _declared?: string): Promise<protocol.MediaRecord> {
    if (media.status === 'ready') return toMediaRecord(media)
    if (media.status !== 'pending') throw new MediaRefusedError('not-ready')

    const opened = await this.storages.openProfileById(media.profileId)
    const stored = await opened.storage.head(media.storageKey)

    if (!stored) throw new MediaRefusedError('not-ready')
    if (!this.matchesGrant(media, stored)) await this.refuseObject(media, opened)

    const confirmed: ConfirmedObject = {
      sizeBytes: stored.sizeBytes,
      mimeType: stored.contentType,
      sha256: stored.sha256 ?? null,
    }

    const held = confirmed.sha256
      ? await this.rows.findReadyByDigest(media.schoolId, confirmed.sha256)
      : null

    if (held) return this.dropCopy(media, opened, held)

    return this.recordReady(media, opened, confirmed)
  }

  private assertUploadable(request: protocol.CreateUploadRequest): void {
    if (!isAllowedMimeType(request.kind, request.mimeType)) {
      throw new MediaRefusedError('type-not-allowed')
    }

    if (request.sizeBytes > maxBytesOf(this.config, request.kind)) {
      throw new MediaRefusedError('too-large')
    }
  }

  /**
   * Room for the reservation just written, or no reservation and a refusal.
   *
   * The row is written before the question is answered because the answer is
   * the database's: a school's room is what its rows say it is, and asking
   * before writing is what lets parallel grants overfill the bucket together.
   */
  private async assertRoomFor(reserved: Media, profile: StorageProfile): Promise<void> {
    const quotaBytes = quotaBytesFor(
      await this.quotas.findQuotaBytes(reserved.schoolId),
      profile.schoolId !== null,
      this.config.defaultQuotaBytes,
    )

    if (quotaBytes === null) return
    if (await this.rows.keepIfRoom(reserved, quotaBytes)) return

    throw new MediaRefusedError('quota-exceeded')
  }

  /** Above the hashing limit the browser is not asked for a digest, so nothing matches. */
  private isDeduplicated(request: protocol.CreateUploadRequest): boolean {
    return Boolean(request.sha256) && request.sizeBytes <= this.config.hashLimitBytes
  }

  private matchesGrant(media: Media, stored: StoredObject): boolean {
    return stored.sizeBytes === Number(media.sizeBytes) && stored.contentType === media.mimeType
  }

  private async refuseObject(media: Media, opened: SchoolStorage): Promise<never> {
    await this.rows.markFailed(media.id)
    await opened.storage.remove(media.storageKey)

    throw new MediaRefusedError('not-ready')
  }

  /**
   * Turns the row ready, unless another completion of the same bytes got there
   * first.
   *
   * One ready row per school and digest is an index, and the completion that
   * loses to it has landed a copy the school does not need: it reads the row
   * that won and drops its own object, rather than answering the uploader with
   * a failed write and leaving the reservation to the sweep.
   */
  private async recordReady(
    media: Media,
    opened: SchoolStorage,
    confirmed: ConfirmedObject,
  ): Promise<protocol.MediaRecord> {
    try {
      return toMediaRecord(await this.rows.markReady(media, confirmed))
    } catch (failure) {
      if (!isDigestCollision(failure) || !confirmed.sha256) throw failure

      const held = await this.rows.findReadyByDigest(media.schoolId, confirmed.sha256)
      if (!held) throw failure

      return this.dropCopy(media, opened, held)
    }
  }

  /** The school already holds these bytes, so the second copy is the one that goes. */
  private async dropCopy(
    media: Media,
    opened: SchoolStorage,
    held: Media,
  ): Promise<protocol.MediaRecord> {
    await opened.storage.remove(media.storageKey)
    await this.rows.deleteRow(media.id)

    return toMediaRecord(held)
  }
}
