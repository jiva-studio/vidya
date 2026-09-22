import { Inject, Injectable, OnModuleInit } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { InjectDataSource } from '@nestjs/typeorm'
import { MediaConfig } from '@vidya/api/configs'
import { StorageProfile } from '@vidya/entities'
import { DataSource } from 'typeorm'

/**
 * Refuses to start when credentials are stored and the key that opens them is
 * not configured.
 *
 * Starting anyway would come to the same thing one request later — every
 * upload and every playback for those schools failing — except that it would
 * fail as a scattering of 500s instead of as one sentence naming the variable
 * that is missing. An installation where no school has handed over credentials
 * has nothing to open and starts without the key.
 */
@Injectable()
export class MediaMasterKeyService implements OnModuleInit {
  constructor(
    @Inject(MediaConfig.KEY) private readonly config: ConfigType<typeof MediaConfig>,
    @InjectDataSource() private readonly dataSource: DataSource,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.config.masterKey) return

    const sealed = await this.dataSource.getRepository(StorageProfile).count()
    if (sealed === 0) return

    throw new Error(
      `VIDYA_MEDIA_MASTER_KEY is not set, and ${sealed} storage profile(s) are sealed under it; ` +
        'the API refuses to start rather than serve schools whose storage it cannot reach.',
    )
  }
}
