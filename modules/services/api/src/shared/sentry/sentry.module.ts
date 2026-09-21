import { Global, Module } from '@nestjs/common'
import { ConfigModule, ConfigType } from '@nestjs/config'

import SentryConfig from '../../configs/sentry.config'
import { LoggingModule } from '../logging/logging.module'
import { SentryService } from './sentry.service'
import { SentryExceptionFilter } from './sentry-exception.filter'

@Global()
@Module({
  imports: [ConfigModule, LoggingModule],
  providers: [
    {
      provide: SentryService,
      useFactory: (config: ConfigType<typeof SentryConfig>) =>
        new SentryService({
          dsn: config.dsn,
          environment: config.environment,
          release: config.release,
          tracesSampleRate: config.tracesSampleRate,
          enabled: config.enabled,
        }),
      inject: [SentryConfig.KEY],
    },
    SentryExceptionFilter,
  ],
  exports: [SentryService, SentryExceptionFilter],
})
export class SentryModule {}
