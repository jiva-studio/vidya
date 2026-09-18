import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import {
  CoursesService,
  EnrollmentsService,
  LessonsService,
  LessonVersionsService,
  SchoolsService,
  UsersService,
} from '@vidya/api/edu/services'
import * as domain from '@vidya/domain'
import { Course, Enrollment, Lesson, LessonVersion } from '@vidya/entities'
import { DataSource } from 'typeorm'

export const SECTION_ID = domain.asId<domain.SectionId>('11111111-1111-4111-8111-111111111111')
export const BLOCK_ID = domain.asId<domain.BlockId>('22222222-2222-4222-8222-222222222222')

/** A course with a lesson, a published version and a draft nobody may see. */
export interface CourseWorld {
  course: Course
  lesson: Lesson
  published: LessonVersion
  draft: LessonVersion
}

export interface SyncContext {
  schoolId: domain.SchoolId

  /** The course the student holds a place on. */
  mine: CourseWorld

  /** A course the student has nothing to do with. */
  theirs: CourseWorld

  student: { id: domain.UserId }
  stranger: { id: domain.UserId }
  pending: { id: domain.UserId }

  enrollment: Enrollment
  strangerEnrollment: Enrollment
  pendingEnrollment: Enrollment

  tokens: { student: string; stranger: string; pending: string }
}

const content = (): domain.LessonContent => ({
  schemaVersion: domain.LessonContentSchemaVersion,
  sections: [
    {
      id: SECTION_ID,
      title: 'Introduction',
      assessment: 'teacher',
      blocks: [{ id: BLOCK_ID, type: 'text', content: 'Read this' }],
    },
  ],
})

/**
 * Two courses, three students and one school.
 *
 * Built through the ordinary services on purpose: every journal row these
 * fixtures leave behind is a row the admin console would have produced, so a
 * test that reads them back is testing the same path production uses.
 */
export const createSyncContext = async (app: INestApplication): Promise<SyncContext> => {
  const schools = app.get(SchoolsService)
  const users = app.get(UsersService)
  const enrollments = app.get(EnrollmentsService)
  const auth = app.get(AuthService)

  const school = await schools.create({ name: faker.company.name() })

  const mine = await createCourse(app, school.id, 'Bhakti-shastri')
  const theirs = await createCourse(app, school.id, 'Sanskrit for beginners')

  const student = await users.create({ email: faker.internet.email() })
  const stranger = await users.create({ email: faker.internet.email() })
  const pendingStudent = await users.create({ email: faker.internet.email() })

  const enrollment = await enrollments.create({
    courseId: mine.course.id,
    studentId: student.id,
    schoolId: school.id,
    status: 'accepted',
  })

  const strangerEnrollment = await enrollments.create({
    courseId: theirs.course.id,
    studentId: stranger.id,
    schoolId: school.id,
    status: 'accepted',
  })

  const pendingEnrollment = await enrollments.create({
    courseId: theirs.course.id,
    studentId: pendingStudent.id,
    schoolId: school.id,
    status: 'pending',
  })

  const token = async (userId: domain.UserId) => (await auth.generateTokens(userId, [])).accessToken

  return {
    schoolId: school.id,
    mine,
    theirs,
    student,
    stranger,
    pending: pendingStudent,
    enrollment,
    strangerEnrollment,
    pendingEnrollment,
    tokens: {
      student: await token(student.id),
      stranger: await token(stranger.id),
      pending: await token(pendingStudent.id),
    },
  }
}

const createCourse = async (
  app: INestApplication,
  schoolId: domain.SchoolId,
  name: string,
): Promise<CourseWorld> => {
  const courses = app.get(CoursesService)
  const lessons = app.get(LessonsService)
  const versions = app.get(LessonVersionsService)

  const course = await courses.create({ name, learningType: 'individual', schoolId })

  const lesson = await lessons.create({
    courseId: course.id,
    schoolId,
    lessonNumber: 1,
    title: 'Introduction',
  })

  const published = await versions.create({
    lessonId: lesson.id,
    version: 1,
    status: 'published',
    publishedAt: new Date(),
    content: content(),
  })

  const draft = await versions.create({
    lessonId: lesson.id,
    version: 2,
    status: 'draft',
    content: content(),
  })

  return { course, lesson, published, draft }
}

/** Every journal row, oldest first. */
export const journalRows = async (ds: DataSource): Promise<Record<string, unknown>[]> =>
  ds.query('SELECT * FROM sync_journal ORDER BY global_seq')

/**
 * Journal rows written straight to the table, bypassing the subscriber.
 *
 * The read path is what these fixtures exercise, and producing five hundred
 * rows through the domain services would be five hundred courses nobody reads.
 * Everything that matters to a pull — the addressee, the order, the device —
 * is a column, so writing the columns is writing the case.
 */
export const seedJournal = async (
  ds: DataSource,
  scope: domain.SyncScopeRef,
  options: { schoolId: domain.SchoolId; count: number; deviceId?: string; from?: number },
): Promise<void> => {
  const from = options.from ?? 0

  for (let index = 0; index < options.count; index += 1) {
    await ds.query(
      `INSERT INTO sync_journal
         (collection, doc_id, op, data, hlc, scope_kind, scope_id, school_id, device_id, author_id)
       VALUES ('block_states', $1, 'upsert', $2, $3, $4, $5, $6, $7, NULL)`,
      [
        faker.string.uuid(),
        JSON.stringify({ seeded: from + index }),
        `${String(from + index + 1).padStart(15, '0')}:00000:seed`,
        scope.kind,
        scope.id,
        options.schoolId,
        options.deviceId ?? null,
      ],
    )
  }
}
