import { Module } from '@nestjs/common'
import { ConfigType } from '@nestjs/config'
import { JwtModule } from '@nestjs/jwt'
import { TypeOrmModule } from '@nestjs/typeorm'
import { MailerModule } from '@nestjs-modules/mailer'
import { HandlebarsAdapter } from '@nestjs-modules/mailer/adapters/handlebars.adapter'
import { AuditLogService, RedisService } from '@vidya/api/shared/services'
import { RedisThrottlerStorageModule } from '@vidya/api/shared/throttling'
import { AuditLog, Role, User, UserRole } from '@vidya/entities'

import { MailerConfig } from '../configs'
import { OtpController } from './controllers/otp.controller'
import { ProfileController } from './controllers/profile.controller'
import { TokensController } from './controllers/tokens.controller'
import { UserAuthenticationController } from './controllers/user-authentication.controller'
import { AuthService } from './services/auth.service'
import { AuthUsersService } from './services/auth-users.service'
import { OtpService } from './services/otp.service'
import { RevokedTokensService } from './services/revokedTokens.service'

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, UserRole, AuditLog]),
    JwtModule.register({ global: true }),
    RedisThrottlerStorageModule,
    MailerModule.forRootAsync({
      useFactory: (config: ConfigType<typeof MailerConfig>) => ({
        transport: {
          pool: true,
          host: config.host,
          port: config.port,
          secure: false,
          auth: {
            user: config.username,
            pass: config.password,
          },
        },
        template: {
          dir: process.cwd() + '/src/auth/templates/',
          adapter: new HandlebarsAdapter(),
          options: {
            strict: true,
          },
        },
      }),
      inject: [MailerConfig.KEY],
    }),
  ],
  controllers: [UserAuthenticationController, OtpController, TokensController, ProfileController],
  providers: [
    OtpService,
    AuthUsersService,
    AuthService,
    RevokedTokensService,
    RedisService,
    AuditLogService,
  ],
})
export class AuthModule {}
