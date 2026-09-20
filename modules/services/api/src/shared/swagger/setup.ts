import { INestApplication } from '@nestjs/common'
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger'
import { AppName } from '@vidya/domain'

/**
 * `NODE_ENV` is read directly, not through the `configs/` pattern: those files
 * register values Nest injects across the app, and this is one boolean read
 * exactly once, at the top of `bootstrap()`, before DI is even reachable.
 */
export const isProductionEnvironment = (env: string | undefined = process.env.NODE_ENV): boolean =>
  env === 'production'

/**
 * The Swagger document is a complete map of the API: every route, every DTO
 * field and validation rule, plus the production server address. That is not
 * a vulnerability by itself — the API is not secured by being undocumented —
 * but it hands an attacker all of the reconnaissance for free, and the
 * Swagger UI is extra surface on the same origin as the API. Neither belongs
 * outside development.
 */
export const setupSwagger = (
  app: INestApplication,
  env: string | undefined = process.env.NODE_ENV,
): void => {
  if (isProductionEnvironment(env)) {
    return
  }

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
}
