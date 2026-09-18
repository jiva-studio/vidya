import { ValidationPipe } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { NestFactory } from '@nestjs/core'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppName } from '@vidya/domain'
import { useContainer } from 'class-validator'

import { AppModule } from './app.module'
import { bootstrapMigrations } from './shared/migrations'

async function bootstrap() {
  const app = await NestFactory.create(AppModule)

  // Before anything is served. A request answered against a half-migrated
  // schema is worse than a slow start.
  await bootstrapMigrations(app.get(ConfigService))

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
