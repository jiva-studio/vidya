import { INestApplication, ValidationPipe } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { AppModule } from '@vidya/api/app.module'
import { testingDataSource } from '@vidya/api/shared/datasources'
import { RedisService } from '@vidya/api/shared/services'
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

export const createTestingApp = async (
  overrides: readonly TestingOverride[] = [],
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

  const app = module.createNestApplication()
  useContainer(app.select(AppModule), { fallbackOnErrors: true })
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }))
  await app.init()
  return app
}
