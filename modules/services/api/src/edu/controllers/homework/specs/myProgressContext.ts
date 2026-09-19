import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import {
  BlockStatesService,
  CoursesService,
  EnrollmentsService,
  LessonsService,
  LessonVersionsService,
  SchoolsService,
  UsersService,
} from '@vidya/api/edu/services'
import * as domain from '@vidya/domain'
import { emptyLessonContent } from '@vidya/domain'

/**
 * A student with a place on two courses, because that is the case the single
 * `enrollmentId` query could not express.
 */
export type Context = {
  firstEnrollmentId: domain.EnrollmentId
  secondEnrollmentId: domain.EnrollmentId
  firstVersionId: domain.LessonVersionId
  secondVersionId: domain.LessonVersionId
  tokens: {
    student: string
    /** Enrolled on the first course as well, with progress of their own. */
    otherStudent: string
  }
}

export const createContext = async (app: INestApplication): Promise<Context> => {
  const schools = app.get(SchoolsService)
  const courses = app.get(CoursesService)
  const lessons = app.get(LessonsService)
  const versions = app.get(LessonVersionsService)
  const enrollments = app.get(EnrollmentsService)
  const blockStates = app.get(BlockStatesService)
  const users = app.get(UsersService)
  const auth = app.get(AuthService)

  const school = await schools.create({ name: faker.company.name() })

  const publishedCourse = async (name: string) => {
    const course = await courses.create({ name, learningType: 'group', schoolId: school.id })

    const lesson = await lessons.create({
      courseId: course.id,
      schoolId: school.id,
      lessonNumber: 1,
      title: `${name} · lesson one`,
    })

    const version = await versions.create({
      lessonId: lesson.id,
      version: 1,
      status: 'published',
      publishedAt: new Date(),
      content: emptyLessonContent(),
    })

    return { courseId: course.id, versionId: version.id }
  }

  const first = await publishedCourse('Bhakti-shastri')
  const second = await publishedCourse('Bhakti-vaibhava')

  const student = await users.create({ email: faker.internet.email() })
  const otherStudent = await users.create({ email: faker.internet.email() })

  const place = async (courseId: domain.CourseId, studentId: domain.UserId) =>
    enrollments.create({ courseId, studentId, schoolId: school.id, status: 'accepted' })

  const firstEnrollment = await place(first.courseId, student.id)
  const secondEnrollment = await place(second.courseId, student.id)
  const otherEnrollment = await place(first.courseId, otherStudent.id)

  const progress = async (
    enrollmentId: domain.EnrollmentId,
    lessonVersionId: domain.LessonVersionId,
    blockId: string,
  ) =>
    blockStates.create({
      enrollmentId,
      lessonVersionId,
      blockId: domain.asId<domain.BlockId>(blockId),
      schoolId: school.id,
      state: { type: 'text', read: true },
      updatedAt: new Date(),
    })

  await progress(firstEnrollment.id, first.versionId, '11111111-1111-4111-8111-111111111111')
  await progress(secondEnrollment.id, second.versionId, '22222222-2222-4222-8222-222222222222')
  await progress(otherEnrollment.id, first.versionId, '33333333-3333-4333-8333-333333333333')

  const token = async (userId: domain.UserId) => (await auth.generateTokens(userId, [])).accessToken

  return {
    firstEnrollmentId: firstEnrollment.id,
    secondEnrollmentId: secondEnrollment.id,
    firstVersionId: first.versionId,
    secondVersionId: second.versionId,
    tokens: {
      student: await token(student.id),
      otherStudent: await token(otherStudent.id),
    },
  }
}
