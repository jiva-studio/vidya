import { Module } from '@nestjs/common'
import { ConfigModule, ConfigType } from '@nestjs/config'
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
} from '@vidya/api/configs'
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
    AuthModule,
    EduModule,
    SyncModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
