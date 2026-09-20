import { INestApplication, ValidationPipe } from '@nestjs/common'
import { NestExpressApplication } from '@nestjs/platform-express'
import { Test } from '@nestjs/testing'
import { AppModule } from '@vidya/api/app.module'
import { testingDataSource } from '@vidya/api/shared/datasources'
import { RedisService } from '@vidya/api/shared/services'
import { SYNC_MAX_BATCH_BYTES } from '@vidya/protocol'
import { useContainer } from 'class-validator'
import { DataSource } from 'typeorm'

/**
 * A provider to swap out for the duration of one suite.
 *
 * The datasource and Redis are replaced for every suite because nothing can run
 * without them. Anything else — the mailer, a clock — is the suite's own
 * business, so it says so rather than the factory guessing.
 */
export type TestingOverride = {
  provide: any
  useValue: any
}

/**
 * Applied to the app between creation and `init()`, for the few things that are
 * bootstrap's rather than a module's — CORS is the one there is. After `init()`
 * it is too late: the middleware stack is already built.
 */
export type TestingBootstrap = (app: NestExpressApplication) => void

export const createTestingApp = async (
  overrides: readonly TestingOverride[] = [],
  bootstrap?: TestingBootstrap,
): Promise<INestApplication> => {
  let builder = Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(DataSource)
    .useValue(await testingDataSource())
    .overrideProvider(RedisService)
    .useValue({
      get: jest.fn(),
      set: jest.fn(),
      exists: jest.fn(),
      del: jest.fn(),
    })

  for (const { provide, useValue } of overrides) {
    builder = builder.overrideProvider(provide).useValue(useValue)
  }

  const module = await builder.compile()

  const app = module.createNestApplication<NestExpressApplication>()

  // The same ceiling `main.ts` sets. Without it the framework default of 100kB
  // refuses a sync batch before any handler sees it, and the suite would be
  // testing a limit production does not have.
  app.useBodyParser('json', { limit: SYNC_MAX_BATCH_BYTES })
  bootstrap?.(app)
  useContainer(app.select(AppModule), { fallbackOnErrors: true })
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  await app.init()
  return app
}
