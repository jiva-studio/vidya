import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { NestExpressApplication } from '@nestjs/platform-express'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppName } from '@vidya/domain'
import { SYNC_MAX_BATCH_BYTES } from '@vidya/protocol'
import { useContainer } from 'class-validator'

import { AppModule } from './app.module'
import { corsOptionsFor } from './shared/cors'
import { bootstrapMigrations } from './shared/migrations'

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

  // TODO Use on development environment only
  const config = new DocumentBuilder()
    .setTitle(AppName)
    .setDescription(`The ${AppName} API`)
    .setVersion('1.0') // TODO Use version from package.json
    .setContact('AKd Studios', 'https://github.com/akdasa-studios/', '')
    .addBearerAuth()
    .addTag('🎟️ Authentication :: One-Time Password')
    .addTag('🔐 Authentication', 'Endpoints for authentication', {
      description: 'Docs',
      url: 'https://github.com/akdasa-studios/vidya/blob/main/docs/adr/001%20Authentication%20and%20Authorization.md',
    })
    .addTag('🕵️‍♂️ Education :: Roles', 'Roles management')
    .addTag('🧝 Education :: Users', 'Users management')
    .addTag('🏫 Education :: Schools', 'Schools management')
    .addTag('🎓 Education :: Courses', 'Courses management')
    .addTag('🎓 Education :: Groups', 'Groups within a course')
    .addTag('🎓 Education :: Lessons', 'Lessons management')
    .addTag('🎓 Education :: Lesson Versions', 'Draft and published lesson content')
    .addTag('🎓 Education :: Enrollments', 'Joining a course, and moderating who joins')
    .addTag('🎓 Education :: Homework', 'Submitting and reviewing work')
    .addTag('🎓 Education :: Progress', 'Per-block progress through a lesson')
    .addTag('🔄 Sync', 'Offline synchronisation: pull, push and the applied position')
    .addServer('http://localhost:8001', 'Development server')
    .addServer('https://api.vidya.com', 'Production server')
    .build()
  const documentFactory = () => SwaggerModule.createDocument(app, config)
  SwaggerModule.setup('swagger', app, documentFactory)
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
