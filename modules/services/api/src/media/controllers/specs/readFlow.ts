import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import {
  CoursesService,
  EnrollmentsService,
  LessonsService,
  LessonVersionsService,
  UsersService,
} from '@vidya/api/edu/services'
import * as domain from '@vidya/domain'
import { User } from '@vidya/entities'
import { Routes } from '@vidya/protocol'
import * as request from 'supertest'

import { createMediaFlow, MediaFlow } from './uploadFlow'

/** One allowed type per kind, so a stored file of any kind can be asked for. */
const MIME: Readonly<Record<domain.MediaKind, string>> = Object.freeze({
  image: 'image/png',
  audio: 'audio/mpeg',
  video: 'video/mp4',
})

const BYTES = 2048

const newId = <TId extends domain.Id<string>>(): TId => domain.asId<TId>(faker.string.uuid())

/** A lesson document that addresses the given files the way the editor saves them. */
const contentAddressing = (mediaIds: string[]): domain.LessonContent => ({
  schemaVersion: domain.LessonContentSchemaVersion,
  sections: [
    {
      id: newId<domain.SectionId>(),
      title: 'Illustrations',
      assessment: 'none',
      blocks: mediaIds.map((mediaId) => ({
        id: newId<domain.BlockId>(),
        type: 'image' as const,
        source: 'upload' as const,
        url: domain.mediaPath(domain.asId<domain.MediaId>(mediaId)),
      })),
    },
  ],
})

/** A course whose published lesson shows some files and whose draft shows others. */
export type Coursework = {
  courseId: domain.CourseId

  /** A student accepted on this course, holding no permission at all. */
  studentToken: string

  /** An account with a place on no course at all. */
  strangerToken: string
}

export type ReadFlow = {
  flow: MediaFlow

  /** A `ready` row of the given kind, uploaded the way a browser uploads. */
  storeReady(schoolId: string, user: User, kind?: domain.MediaKind): Promise<string>

  askUrls(ids: string[], token: string): Promise<request.Response>
  tokenOf(user: User): Promise<string>

  /**
   * A course in the school, with one published lesson addressing `published`
   * and a never-published draft addressing `drafted`.
   */
  publishCoursework(
    schoolId: domain.SchoolId,
    published: string[],
    drafted?: string[],
  ): Promise<Coursework>

  /** How many times storage was asked to sign a read of this object. */
  signedReadsOf(key: string): number

  /** The storage key of a stored row, as the object is addressed. */
  keyOf(mediaId: string): Promise<string>
}

export const createReadFlow = async (app: INestApplication): Promise<ReadFlow> => {
  const flow = await createMediaFlow(app)
  const courses = app.get(CoursesService)
  const lessons = app.get(LessonsService)
  const versions = app.get(LessonVersionsService)
  const enrollments = app.get(EnrollmentsService)
  const users = app.get(UsersService)
  const auth = app.get(AuthService)

  await flow.configureStorage(flow.ctx.one.school.id, flow.ctx.one.users.owner)
  await flow.configureStorage(flow.ctx.two.school.id, flow.ctx.two.users.technician)

  /** An account the installation has, carrying nothing it could read media with. */
  const accountWithoutPermissions = async () => {
    const account = await users.create({ email: faker.internet.email() })
    const tokens = await auth.generateTokens(account.id, [])

    return { id: account.id, token: `Bearer ${tokens.accessToken}` }
  }

  return {
    flow,

    async storeReady(schoolId, user, kind = 'image') {
      const asked = await flow.askUpload(
        flow.imageUpload(schoolId, {
          kind,
          mimeType: MIME[kind],
          name: `lesson.${kind}`,
          sizeBytes: BYTES,
          sha256: undefined,
        }),
        user,
      )

      if (asked.status !== 201) throw new Error(`no grant for a ${kind}: ${asked.status}`)

      await flow.putBytes(asked.body.grant, Buffer.alloc(BYTES, 3))
      const completed = await flow.completeUpload(asked.body.mediaId, {}, user)
      if (completed.status !== 200) throw new Error(`bytes never landed: ${completed.status}`)

      return asked.body.mediaId as string
    },

    async askUrls(ids, token) {
      return request(app.getHttpServer())
        .post(Routes().media.urls())
        .set('Authorization', token)
        .send({ ids })
    },

    async tokenOf(user) {
      return flow.ctx.getAuthTokenFor(user)
    },

    async publishCoursework(schoolId, published, drafted = []) {
      const course = await courses.create({
        name: faker.company.catchPhrase(),
        learningType: 'group',
        schoolId,
      })

      const shown = await lessons.create({
        courseId: course.id,
        schoolId,
        lessonNumber: 1,
        title: 'Published',
      })

      await versions.create({
        lessonId: shown.id,
        version: 1,
        status: 'published',
        publishedAt: new Date(),
        content: contentAddressing(published),
      })

      if (drafted.length > 0) {
        const hidden = await lessons.create({
          courseId: course.id,
          schoolId,
          lessonNumber: 2,
          title: 'Still being written',
        })

        await versions.create({
          lessonId: hidden.id,
          version: 1,
          status: 'draft',
          content: contentAddressing(drafted),
        })
      }

      const enrolled = await accountWithoutPermissions()
      await enrollments.create({
        courseId: course.id,
        studentId: enrolled.id,
        schoolId,
        status: 'accepted',
      })

      return {
        courseId: course.id,
        studentToken: enrolled.token,
        strangerToken: (await accountWithoutPermissions()).token,
      }
    },

    signedReadsOf(key) {
      return flow.storage.calls.filter((call) => call.op === 'signRead' && call.key === key).length
    },

    async keyOf(mediaId) {
      const row = await flow.mediaRow(mediaId)
      if (!row) throw new Error(`no media row ${mediaId}`)

      return row.storageKey
    },
  }
}
