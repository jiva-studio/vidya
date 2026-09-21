import { Controller, INestApplication, Post, RequestMethod, UploadedFile } from '@nestjs/common'
import { METHOD_METADATA, PATH_METADATA, ROUTE_ARGS_METADATA } from '@nestjs/common/constants'
import { RouteParamtypes } from '@nestjs/common/enums/route-paramtypes.enum'
import { ModulesContainer } from '@nestjs/core'
import { ApiConsumes } from '@nestjs/swagger'
import { createTestingApp } from '@vidya/api/edu/shared'
import { TEST_MASTER_KEY } from '@vidya/api/media/controllers/specs/context'
import { createMediaFlow, MediaFlow } from '@vidya/api/media/controllers/specs/uploadFlow'
import { Routes } from '@vidya/protocol'
import * as request from 'supertest'

// The key `@ApiConsumes` writes under. Spelled out because the package's
// `exports` map hides the module that declares it.
const API_CONSUMES = 'swagger/apiConsumes'

type DeclaredRoute = { method: string; path: string; takesFileBody: boolean }

type ControllerType = { prototype: Record<string, (...args: never[]) => unknown> }

const pathOf = (value: string): string => `/${value}`.replace(/\/+/g, '/').replace(/\/$/, '')

/**
 * Whether a handler is written to receive a file: a `@UploadedFile`-style
 * parameter, or a multipart body announced to the client.
 *
 * A body read straight off the request object cannot be seen from here, which
 * is why one case drives a multipart request through the signing route as well.
 */
const takesFileBody = (controller: ControllerType, method: string): boolean => {
  const args: Record<string, unknown> =
    Reflect.getMetadata(ROUTE_ARGS_METADATA, controller, method) ?? {}

  const fileParam = Object.keys(args).some((key) => {
    const paramType = Number(key.split(':')[0])
    return paramType === RouteParamtypes.FILE || paramType === RouteParamtypes.FILES
  })

  const consumes: string[] = Reflect.getMetadata(API_CONSUMES, controller.prototype[method]) ?? []

  return fileParam || consumes.some((type) => type.includes('multipart'))
}

const handlerNames = (controller: ControllerType): string[] =>
  Object.getOwnPropertyNames(controller.prototype).filter(
    (name) =>
      name !== 'constructor' &&
      typeof controller.prototype[name] === 'function' &&
      Reflect.getMetadata(METHOD_METADATA, controller.prototype[name]) !== undefined,
  )

const routesOf = (controller: ControllerType): DeclaredRoute[] => {
  const base = (Reflect.getMetadata(PATH_METADATA, controller) as string) ?? ''

  return handlerNames(controller).map((name) => {
    const handler = controller.prototype[name]

    return {
      method: RequestMethod[Reflect.getMetadata(METHOD_METADATA, handler)],
      path: pathOf(`${base}/${Reflect.getMetadata(PATH_METADATA, handler) ?? ''}`),
      takesFileBody: takesFileBody(controller, name),
    }
  })
}

const asController = (type: unknown): ControllerType => type as ControllerType

const declaredRoutes = (app: INestApplication): DeclaredRoute[] =>
  [...app.get(ModulesContainer).values()]
    .flatMap((module) => [...module.controllers.values()])
    .map((wrapper) => wrapper.metatype as ControllerType | undefined)
    .filter((controller): controller is ControllerType => Boolean(controller?.prototype))
    .flatMap(routesOf)

@Controller('probe')
class FileTakingProbe {
  @Post()
  storeFile(@UploadedFile() file: unknown): unknown {
    return file
  }

  @Post('form')
  @ApiConsumes('multipart/form-data')
  storeForm(): string {
    return 'stored'
  }
}

describe('what the API will accept as a request body', () => {
  let app: INestApplication
  let flow: MediaFlow

  beforeEach(async () => {
    process.env.VIDYA_MEDIA_MASTER_KEY = TEST_MASTER_KEY
    app = await createTestingApp()
    flow = await createMediaFlow(app)
  })

  afterEach(async () => {
    await app.close()
  })

  it('declares the three routes an upload is driven through', async () => {
    const paths = declaredRoutes(app).map((route) => `${route.method} ${route.path}`)

    expect(paths).toEqual(
      expect.arrayContaining([
        `POST ${Routes().media.uploads()}`,
        `POST ${Routes().media.complete(':id')}`,
        `GET ${Routes().media.find()}`,
      ]),
    )
  })

  it('declares no route that receives a file', async () => {
    const receivers = declaredRoutes(app)
      .filter((route) => route.takesFileBody)
      .map((route) => `${route.method} ${route.path}`)

    expect(receivers).toEqual([])
  })

  it('recognises a handler that does receive a file, so the sweep can fail', async () => {
    expect(takesFileBody(asController(FileTakingProbe), 'storeFile')).toBe(true)
  })

  it('recognises a handler that announces a multipart body', async () => {
    expect(takesFileBody(asController(FileTakingProbe), 'storeForm')).toBe(true)
  })

  it('refuses a file sent to the route that signs uploads', async () => {
    await flow.configureStorage(flow.ctx.one.school.id, flow.ctx.one.users.owner)

    const response = await request(app.getHttpServer())
      .post(Routes().media.uploads())
      .set('Authorization', await flow.ctx.getAuthTokenFor(flow.ctx.one.users.owner))
      .attach('file', Buffer.alloc(2048, 9), 'lesson-cover.png')

    expect(response.status).toBeGreaterThanOrEqual(400)
    expect(await flow.mediaRowsOf(flow.ctx.one.school.id)).toEqual([])
  })
})
