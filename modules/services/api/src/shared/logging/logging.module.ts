import { Global, MiddlewareConsumer, Module, NestModule } from '@nestjs/common'
import { ConfigModule, ConfigType } from '@nestjs/config'

import LoggingConfig from '../../configs/logging.config'
import { LoggerService } from './logger.service'
import { RequestLoggingMiddleware } from './request-logging.middleware'

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: LoggerService,
      useFactory: (config: ConfigType<typeof LoggingConfig>) =>
        new LoggerService({ level: config.level, format: config.format }),
      inject: [LoggingConfig.KEY],
    },
    RequestLoggingMiddleware,
  ],
  exports: [LoggerService, RequestLoggingMiddleware],
})
export class LoggingModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggingMiddleware).forRoutes('*')
  }
}
