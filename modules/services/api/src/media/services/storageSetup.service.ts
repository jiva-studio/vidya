import { randomUUID } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { MediaConfig } from '@vidya/api/configs'
import {
  deliveryFor,
  hasOwnCredentials,
  isLentProfile,
  secretTailOf,
  StorageOccupancy,
  toStorageProfileView,
} from '@vidya/api/media/mappers'
import { SchoolId, StorageProfileId } from '@vidya/domain'
import { StorageProfile } from '@vidya/entities'
import * as protocol from '@vidya/protocol'

import { StorageCredentials } from '../infra/ports'
import { StorageFailedError } from '../storageFailure'
import { EndpointGuardService } from './endpointGuard.service'
import { defaultPrefixOf } from './mediaLimits'
import { MediaUsageService } from './mediaUsage.service'
import { SecretSealingService } from './secretSealing.service'
import { hasOwnEndpoint, storageEndpointFor } from './storageAddress'
import { StorageProbeService } from './storageProbe.service'
import { StorageProfilesService } from './storageProfiles.service'
import { quotaBytesFor, StorageQuotasService } from './storageQuotas.service'

const credentialsOf = (profile: StorageProfile, secret: string): StorageCredentials => ({
  endpoint: storageEndpointFor(profile.provider, profile),
  region: profile.region,
  bucket: profile.bucket,
  prefix: profile.prefix,
  accessKeyId: profile.accessKeyId,
  secret,
})

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
    private readonly usage: MediaUsageService,
  ) {}

  async findProfileView(schoolId: SchoolId): Promise<protocol.StorageProfileView | null> {
    const profile = await this.profiles.findCurrentFor(schoolId)
    if (!profile) return null

    return toStorageProfileView(
      profile,
      this.readSecretTail(profile),
      await this.occupancyOf(schoolId, profile),
    )
  }

  async configureProfile(
    schoolId: SchoolId,
    request: protocol.UpsertStorageProfileRequest,
  ): Promise<protocol.StorageProfileView> {
    const provider = request.provider
    const endpoint = storageEndpointFor(provider, request)

    if (hasOwnEndpoint(provider)) await this.endpoints.assertEndpointAllowed(endpoint)

    const profileId = randomUUID() as StorageProfileId
    const prefix = request.prefix ?? defaultPrefixOf(schoolId)

    await this.probe.probeCredentials({
      endpoint,
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
      endpoint: hasOwnEndpoint(provider) ? endpoint : null,
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

    // Nothing here is the school's to prove: the keys are the installation's,
    // and dialling them in the school's name would say otherwise.
    if (isLentProfile(profile)) throw new StorageFailedError('not-configured')

    const secret = await this.openSecretOrRecord(profile)

    try {
      await this.probe.probeCredentials(credentialsOf(profile, secret))
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

  async retireProfile(schoolId: SchoolId): Promise<void> {
    await this.requireProfile(schoolId)
    await this.profiles.retireProfile(schoolId)
  }

  /**
   * What the school occupies and what it is allowed to occupy.
   *
   * The reservation is reported beside the charge rather than folded into it: a
   * school looking at a full bucket has to be able to see that the room is
   * promised to uploads in flight rather than already spent.
   */
  async readUsage(schoolId: SchoolId): Promise<protocol.StorageUsageResponse> {
    const profile = await this.profiles.findCurrentFor(schoolId)
    const usage = await this.usage.readUsage(schoolId)
    const occupancy = await this.occupancyOf(schoolId, profile)

    return {
      usedBytes: occupancy.usedBytes,
      reservedBytes: usage.reservedBytes,
      quotaBytes: occupancy.quotaBytes,
      countsByKind: usage.countsByKind,
    }
  }

  /**
   * The bytes a school holds and the ceiling it holds them under, neither of
   * them read from the profile.
   *
   * What is occupied is summed from the school's own files, which is why a
   * rotated key cannot reset it: the row that holds the keys is replaced on
   * every rotation, and a counter kept there went with it.
   */
  private async occupancyOf(
    schoolId: SchoolId,
    profile: StorageProfile | null,
  ): Promise<StorageOccupancy> {
    return {
      usedBytes: await this.usage.usedBytesOf(schoolId),
      quotaBytes: await this.quotaFor(schoolId, profile),
    }
  }

  private async quotaFor(
    schoolId: SchoolId,
    profile: StorageProfile | null,
  ): Promise<number | null> {
    return quotaBytesFor(
      await this.quotas.findQuotaBytes(schoolId),
      hasOwnCredentials(profile),
      this.config.defaultQuotaBytes,
    )
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
