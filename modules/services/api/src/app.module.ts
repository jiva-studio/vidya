import { Module } from '@nestjs/common'
import { ConfigModule, ConfigType } from '@nestjs/config'
import { APP_GUARD } from '@nestjs/core'
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler'
import { TypeOrmModule } from '@nestjs/typeorm'
import {
  AuthConfig,
  CorsConfig,
  DbConfig,
  JwtConfig,
  MailerConfig,
  MigrationsConfig,
  OtpConfig,
  RedisConfig,
  SecurityHeadersConfig,
  ThrottlerConfig,
  TrustProxyConfig,
} from '@vidya/api/configs'
import { RedisThrottlerStorage, RedisThrottlerStorageModule } from '@vidya/api/shared/throttling'
import { Entities } from '@vidya/entities'

import { AuthModule } from './auth/auth.module'
import { EduModule } from './edu/edu.module'
import { SyncModule } from './sync/sync.module'

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        CorsConfig,
        DbConfig,
        OtpConfig,
        RedisConfig,
        JwtConfig,
        AuthConfig,
        MailerConfig,
        MigrationsConfig,
        SecurityHeadersConfig,
        ThrottlerConfig,
        TrustProxyConfig,
      ],
    }),
    TypeOrmModule.forRootAsync({
      useFactory: (dbConfig: ConfigType<typeof DbConfig>) => ({
        type: dbConfig.type,
        host: dbConfig.host,
        port: dbConfig.port,
        username: dbConfig.username,
        password: dbConfig.password,
        database: dbConfig.database,
        entities: Entities,
        logging: dbConfig.logging,
        schema: dbConfig.schema,
        autoLoadEntities: true,
        useUTC: true,
      }),
      inject: [DbConfig.KEY],
    }),
    TypeOrmModule.forFeature([]),
    // The app-wide floor every route gets unless it overrides `default` (see
    // `SyncController`, `TokensController`) or layers `KeyedThrottlerGuard` on
    // top (see the OTP and sign-in controllers). Headers are off everywhere:
    // a throttled caller learns nothing about which limit it hit.
    ThrottlerModule.forRootAsync({
      imports: [RedisThrottlerStorageModule],
      inject: [RedisThrottlerStorage, ThrottlerConfig.KEY],
      useFactory: (storage: RedisThrottlerStorage, config: ConfigType<typeof ThrottlerConfig>) => ({
        throttlers: [
          { name: 'default', limit: config.default.limit, ttl: config.default.windowMs },
        ],
        storage,
        setHeaders: false,
      }),
    }),
    AuthModule,
    EduModule,
    SyncModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
