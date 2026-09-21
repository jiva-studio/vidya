import { Module, Provider } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { TypeOrmModule } from '@nestjs/typeorm'
import { AuthUsersService, RevokedTokensService } from '@vidya/api/auth/services'
import { MediaConfig } from '@vidya/api/configs'
import { RedisService } from '@vidya/api/shared/services'
import { Role, School, SchoolStorageQuota, StorageProfile, User, UserRole } from '@vidya/entities'

import { StorageProfilesController } from './controllers'
import {
  DnsAddressResolver,
  FetchSignedHttp,
  FixedAddressResolver,
  InMemoryStorage,
  MEDIA_ADDRESS_RESOLVER,
  MEDIA_SIGNED_HTTP,
  MEDIA_STORAGE,
  S3StorageFactory,
} from './infra'
import {
  EndpointGuardService,
  MediaMasterKeyService,
  SecretSealingService,
  StorageProbeService,
  StorageProfilesService,
  StorageQuotasService,
  StorageSetupService,
} from './services'

const pickDriver = <TPort>(config: ConfigType<typeof MediaConfig>, fake: TPort, real: TPort) =>
  config.driver === 'memory' ? fake : real

/**
 * Which storage the port opens, decided once at boot.
 *
 * The fake is a provider rather than something a suite reaches in and
 * substitutes, so the choice is visible in one place and a suite that needs the
 * real driver says so through the environment instead of undoing an override.
 */
const storageProviders: Provider[] = [
  InMemoryStorage,
  S3StorageFactory,
  FetchSignedHttp,
  DnsAddressResolver,
  FixedAddressResolver,
  {
    provide: MEDIA_STORAGE,
    inject: [MediaConfig.KEY, InMemoryStorage, S3StorageFactory],
    useFactory: pickDriver,
  },
  {
    provide: MEDIA_SIGNED_HTTP,
    inject: [MediaConfig.KEY, InMemoryStorage, FetchSignedHttp],
    useFactory: pickDriver,
  },
  {
    provide: MEDIA_ADDRESS_RESOLVER,
    inject: [MediaConfig.KEY, FixedAddressResolver, DnsAddressResolver],
    useFactory: pickDriver,
  },
]

/**
 * Storage: where a school's files live and the sealed credentials that reach
 * them.
 *
 * It is its own context rather than part of `edu` because what it owns is a
 * third party's secret and an address the API dials from inside our network —
 * concerns that belong together and beside nothing else.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([StorageProfile, SchoolStorageQuota, School, User, Role, UserRole]),
  ],
  controllers: [StorageProfilesController],
  providers: [
    // What the authentication guard needs to read a token; `AuthModule`
    // exports nothing, so every context that guards a route provides them.
    RedisService,
    AuthUsersService,
    RevokedTokensService,

    ...storageProviders,

    EndpointGuardService,
    SecretSealingService,
    StorageProbeService,
    StorageProfilesService,
    StorageQuotasService,
    StorageSetupService,
    MediaMasterKeyService,
  ],
  exports: [StorageProfilesService],
})
export class MediaModule {}
