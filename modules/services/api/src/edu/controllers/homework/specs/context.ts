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

const SECTION_ID = domain.asId<domain.SectionId>('11111111-1111-4111-8111-111111111111')

export type Context = {
  schoolId: string
  sectionId: string
  publishedVersionId: domain.LessonVersionId
  enrollmentId: string
  tokens: {
    /** Accepted on the course. */
    student: string
    /** Has an account, but only a pending request. */
    pendingStudent: string
    /** Not enrolled at all. */
    stranger: string
    teacher: string
  }
}

export const createContext = async (app: INestApplication): Promise<Context> => {
  const schools = app.get(SchoolsService)
  const courses = app.get(CoursesService)
  const lessons = app.get(LessonsService)
  const versions = app.get(LessonVersionsService)
  const enrollments = app.get(EnrollmentsService)
  const users = app.get(UsersService)
  const auth = app.get(AuthService)

  const school = await schools.create({ name: faker.company.name() })

  const course = await courses.create({
    name: 'Bhakti-shastri',
    learningType: 'group',
    schoolId: school.id,
  })

  const lesson = await lessons.create({
    courseId: course.id,
    schoolId: school.id,
    lessonNumber: 1,
    title: 'Introduction',
  })

  const version = await versions.create({
    lessonId: lesson.id,
    version: 1,
    status: 'published',
    publishedAt: new Date(),
    content: {
      sections: [{ id: SECTION_ID, title: 'Introduction', assessment: 'teacher', blocks: [] }],
    },
  })

  const student = await users.create({ email: faker.internet.email() })
  const pendingStudent = await users.create({ email: faker.internet.email() })
  const stranger = await users.create({ email: faker.internet.email() })
  const teacher = await users.create({ email: faker.internet.email() })

  const enrollment = await enrollments.create({
    courseId: course.id,
    studentId: student.id,
    schoolId: school.id,
    status: 'accepted',
  })

  await enrollments.create({
    courseId: course.id,
    studentId: pendingStudent.id,
    schoolId: school.id,
    status: 'pending',
  })

  const token = async (userId: domain.UserId, p: domain.PermissionKey[]) =>
    (await auth.generateTokens(userId, p.length ? [{ sid: school.id, p }] : [])).accessToken

  return {
    schoolId: school.id,
    sectionId: SECTION_ID,
    publishedVersionId: version.id,
    enrollmentId: enrollment.id,
    tokens: {
      student: await token(student.id, []),
      pendingStudent: await token(pendingStudent.id, []),
      stranger: await token(stranger.id, []),
      teacher: await token(teacher.id, ['homework:read', 'homework:grade']),
    },
  }
}
