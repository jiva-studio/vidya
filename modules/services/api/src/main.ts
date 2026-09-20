import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { SYNC_MAX_BATCH_BYTES } from '@vidya/protocol'
import { useContainer } from 'class-validator'

import { AppModule } from './app.module'
import { corsOptionsFor } from './shared/cors'
import { bootstrapMigrations } from './shared/migrations'
import { setupSwagger } from './shared/swagger'

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule)

  // A sync push is answered row by row, so the batch has to reach the handler:
  // the framework default of 100kB would turn a long homework answer into a 413
  // with no reason code, and the device could not tell which row to blame.
  app.useBodyParser('json', { limit: SYNC_MAX_BATCH_BYTES })

  // Before anything is served: a half-migrated schema is worse than a slow start.
  const configService = app.get(ConfigService)
  await bootstrapMigrations(configService)

  // The student app is cross-origin by construction: a native build speaks from
  // `capacitor://localhost`, never from this domain, so without this it cannot
  // reach the API at all and the failure surfaces as a missing header rather
  // than as an error anyone can act on.
  const origins = configService.get<string[]>('cors.origins')
  app.enableCors(corsOptionsFor(origins))

  if (!configService.get<boolean>('cors.configured')) {
    console.warn(
      'VIDYA_CORS_ORIGINS is unset; allowing the local stand only: ' + origins.join(', '),
    )
  }

  setupSwagger(app)
  useContainer(app.select(AppModule), { fallbackOnErrors: true })
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  )

  // TODO Change environment variable to VIDYA_PORT
  await app.listen(process.env.PORT ?? 8001)
}
bootstrap()
