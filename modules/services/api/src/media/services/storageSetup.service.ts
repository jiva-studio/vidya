import { randomUUID } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { MediaConfig } from '@vidya/api/configs'
import {
  deliveryFor,
  secretTailOf,
  StorageOccupancy,
  toStorageProfileView,
} from '@vidya/api/media/mappers'
import { SchoolId, StorageProfileId, StorageProvider } from '@vidya/domain'
import { StorageProfile } from '@vidya/entities'
import * as protocol from '@vidya/protocol'

import { StorageCredentials } from '../infra/ports'
import { StorageFailedError } from '../storageFailure'
import { EndpointGuardService } from './endpointGuard.service'
import { SecretSealingService } from './secretSealing.service'
import { hasOwnEndpoint, storageEndpointFor } from './storageAddress'
import { StorageProbeService } from './storageProbe.service'
import { StorageProfilesService } from './storageProfiles.service'
import { StorageQuotasService } from './storageQuotas.service'

/** Where a school writes when it has not brought a bucket of its own. */
export const defaultPrefixFor = (schoolId: SchoolId): string => `school/${schoolId}`

/**
 * Taking a school's storage credentials, proving them, and answering with what
 * may be read back.
 *
 * Nothing is written until the credentials have been used: a profile in the
 * table is a promise that uploads will land, and a row that has never worked
 * would break the first upload instead of the form that introduced it. The
 * order is therefore address check, probe, then insert.
 */
@Injectable()
export class StorageSetupService {
  constructor(
    @Inject(MediaConfig.KEY) private readonly config: ConfigType<typeof MediaConfig>,
    private readonly endpoints: EndpointGuardService,
    private readonly probe: StorageProbeService,
    private readonly profiles: StorageProfilesService,
    private readonly quotas: StorageQuotasService,
    private readonly sealing: SecretSealingService,
  ) {}

  /**
   * The school's own profile, or the installation's bucket as it is lent to it.
   *
   * A school that brought no keys is not shown nothing: it is storing somewhere,
   * and being told where its files sit is the difference between a screen that
   * explains the arrangement and one that looks broken.
   */
  async findProfileView(schoolId: SchoolId): Promise<protocol.StorageProfileView | null> {
    const own = await this.profiles.findCurrentFor(schoolId)

    if (own) {
      return toStorageProfileView(
        own,
        this.readSecretTail(own),
        await this.occupancyOf(schoolId, own),
      )
    }

    const lent = await this.lentProfile()
    if (!lent) return null

    return toStorageProfileView(lent, '', await this.occupancyOf(schoolId, null), {
      schoolId,
      prefix: defaultPrefixFor(schoolId),
    })
  }

  async configureProfile(
    schoolId: SchoolId,
    request: protocol.UpsertStorageProfileRequest,
  ): Promise<protocol.StorageProfileView> {
    const provider = request.provider
    const approved = await this.approveEndpoint(provider, storageEndpointFor(provider, request))

    this.quotas.assertSettable(request.quotaBytes)

    const profileId = randomUUID() as StorageProfileId
    const prefix = request.prefix ?? defaultPrefixFor(schoolId)

    await this.probe.probeCredentials({
      ...approved,
      region: request.region,
      bucket: request.bucket,
      prefix,
      accessKeyId: request.accessKeyId,
      secret: request.secret,
    })

    const saved = await this.profiles.replaceProfile({
      id: profileId,
      schoolId,
      provider,
      endpoint: hasOwnEndpoint(provider) ? approved.endpoint : null,
      region: request.region,
      r2AccountId: request.r2AccountId ?? null,
      bucket: request.bucket,
      prefix,
      accessKeyId: request.accessKeyId,
      delivery: deliveryFor(request.publicBaseUrl, request.tokenSecret),
      publicBaseUrl: request.publicBaseUrl ?? null,
      secrets: this.sealing.sealProfile(
        { secret: request.secret, tokenSecret: request.tokenSecret },
        { schoolId, profileId },
      ),
      verifiedAt: new Date(),
    })

    // A rotation that repeats no ceiling keeps the one the school has: the
    // ceiling is the school's, and this row is only the keys.
    if (request.quotaBytes !== undefined) {
      await this.quotas.setQuotaBytes(schoolId, request.quotaBytes)
    }

    return toStorageProfileView(
      saved,
      secretTailOf(request.secret),
      await this.occupancyOf(schoolId, saved),
    )
  }

  async verifyProfile(schoolId: SchoolId): Promise<protocol.StorageProfileView> {
    const profile = await this.requireProfile(schoolId)
    const secret = await this.openSecretOrRecord(profile)

    try {
      await this.probe.probeCredentials(await this.credentialsOf(profile, secret))
    } catch (failure) {
      await this.recordFailure(profile, failure)
      throw failure
    }

    const verifiedAt = new Date()
    await this.profiles.recordVerification(profile.id, verifiedAt, null)

    return toStorageProfileView(
      { ...profile, verifiedAt, verifyError: null },
      secretTailOf(secret),
      await this.occupancyOf(schoolId, profile),
    )
  }

  /** Returns the profile that was retired, so the caller can name it. */
  async retireProfile(schoolId: SchoolId): Promise<StorageProfileId> {
    const profile = await this.requireProfile(schoolId)
    await this.profiles.retireProfile(schoolId)

    return profile.id
  }

  /** What the school occupies and what it is allowed to occupy. */
  async readUsage(schoolId: SchoolId): Promise<protocol.StorageUsageResponse> {
    const profile = await this.profiles.findCurrentFor(schoolId)
    const occupancy = await this.occupancyOf(schoolId, profile)

    return {
      usedBytes: occupancy.usedBytes,
      reservedBytes: 0,
      quotaBytes: occupancy.quotaBytes,
      countsByKind: { image: 0, video: 0, audio: 0 },
    }
  }

  /**
   * The credentials of a stored profile, with the address checked again for
   * this dial.
   *
   * Checked again rather than trusted from when the profile was written: the
   * name belongs to the school, and what it answers with today is not what it
   * answered with when the keys were accepted.
   */
  private async credentialsOf(
    profile: StorageProfile,
    secret: string,
  ): Promise<StorageCredentials> {
    const approved = await this.approveEndpoint(
      profile.provider,
      storageEndpointFor(profile.provider, profile),
    )

    return {
      ...approved,
      region: profile.region,
      bucket: profile.bucket,
      prefix: profile.prefix,
      accessKeyId: profile.accessKeyId,
      secret,
    }
  }

  /**
   * The address to dial, and the addresses the check approved for it.
   *
   * A host we composed ourselves carries none: it is not on the allowlist's
   * beat, and there is nobody who could re-point it between the check and the
   * request. A host the school typed is dialled at the addresses that were
   * approved and never resolved a second time.
   */
  private async approveEndpoint(
    provider: StorageProvider,
    endpoint: string,
  ): Promise<{ endpoint: string; addresses?: string[] }> {
    if (!hasOwnEndpoint(provider)) return { endpoint }

    return this.endpoints.assertEndpointAllowed(endpoint)
  }

  /**
   * The installation's bucket as a row, written the first time a school is
   * actually lent it.
   *
   * A row rather than configuration read at every use, because a file names the
   * profile that wrote it: without a row to name, every file in the lent bucket
   * would become unreadable the day the installation changed its own keys. It is
   * not written at boot — an installation whose bucket nobody has touched has no
   * profile.
   */
  private async lentProfile(): Promise<StorageProfile | null> {
    const installation = this.config.defaultStorage
    if (!installation) return null

    const existing = await this.profiles.findInstallationProfile()
    if (existing) return existing

    const profileId = randomUUID() as StorageProfileId

    return this.profiles.createInstallationProfile({
      id: profileId,
      provider: 's3-compatible',
      endpoint: installation.endpoint,
      region: installation.region,
      r2AccountId: null,
      bucket: installation.bucket,
      prefix: '',
      accessKeyId: installation.accessKeyId,
      delivery: deliveryFor(installation.publicBaseUrl, null),
      publicBaseUrl: installation.publicBaseUrl,
      secrets: this.sealing.sealProfile(
        { secret: installation.secret },
        { schoolId: null, profileId },
      ),
      verifiedAt: null,
    })
  }

  /**
   * The bytes a school holds and the ceiling it holds them under, neither of
   * them read from the profile.
   *
   * What is occupied is the sum of the school's own files, which is why a
   * rotated key cannot reset it — and it stays at zero until there are files
   * to sum, because a number invented here is one nobody could reconcile with
   * a bucket.
   */
  private async occupancyOf(
    schoolId: SchoolId,
    profile: StorageProfile | null,
  ): Promise<StorageOccupancy> {
    return { usedBytes: 0, quotaBytes: await this.quotaFor(schoolId, profile) }
  }

  /**
   * The ceiling a school stores under.
   *
   * Only a school nobody has decided about falls back to the installation's
   * default: one that brought a bucket of its own is limited by its provider
   * rather than by us.
   */
  private async quotaFor(
    schoolId: SchoolId,
    profile: StorageProfile | null,
  ): Promise<number | null> {
    const decided = await this.quotas.findQuotaBytes(schoolId)
    if (decided !== undefined) return decided

    return profile ? null : this.config.defaultQuotaBytes
  }

  private async requireProfile(schoolId: SchoolId): Promise<StorageProfile> {
    const profile = await this.profiles.findCurrentFor(schoolId)
    if (!profile) throw new StorageFailedError('not-configured')

    return profile
  }

  private async openSecretOrRecord(profile: StorageProfile): Promise<string> {
    try {
      return this.sealing.openSecret(profile.secrets, {
        schoolId: profile.schoolId,
        profileId: profile.id,
      })
    } catch (failure) {
      await this.recordFailure(profile, failure)
      throw failure
    }
  }

  private async recordFailure(profile: StorageProfile, failure: unknown): Promise<void> {
    if (!(failure instanceof StorageFailedError)) return

    await this.profiles.recordVerification(profile.id, null, failure.refusal)
  }

  /**
   * The tail, or nothing when the ciphertext no longer opens.
   *
   * Reading a profile back must keep working after the secret has become
   * unreadable: that is exactly the state the school has to be shown so it can
   * enter credentials again, and a failure here would hide it behind a 500.
   */
  private readSecretTail(profile: StorageProfile): string {
    try {
      return secretTailOf(
        this.sealing.openSecret(profile.secrets, {
          schoolId: profile.schoolId,
          profileId: profile.id,
        }),
      )
    } catch {
      return ''
    }
  }
}
