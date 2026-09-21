import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import {
  CoursesService,
  LessonsService,
  LessonVersionsService,
  SchoolsService,
  UsersService,
} from '@vidya/api/edu/services'
import * as domain from '@vidya/domain'

const SECTION_ID = domain.asId<domain.SectionId>('11111111-1111-4111-8111-111111111111')
const TEXT_BLOCK_ID = domain.asId<domain.BlockId>('22222222-2222-4222-8222-222222222222')
const QUIZ_BLOCK_ID = domain.asId<domain.BlockId>('33333333-3333-4333-8333-333333333333')

/** The value that must never leave the server. */
export const RIGHT_ANSWER = 2

/** Prose that names the answer, and so must not leave the server either. */
export const EXPLANATION = 'Krishna speaks the Gita to Arjuna on the battlefield.'

const quizContent = (title: string): domain.LessonContent => ({
  schemaVersion: 1,
  sections: [
    {
      id: SECTION_ID,
      title,
      assessment: 'teacher',
      blocks: [
        { id: TEXT_BLOCK_ID, type: 'text', content: 'Read this' },
        {
          id: QUIZ_BLOCK_ID,
          type: 'quiz',
          question: 'Who is the speaker of Bhagavad-gita?',
          answers: ['Arjuna', 'Sanjaya', 'Krishna', 'Dhritarashtra'],
          rightAnswer: RIGHT_ANSWER,
          explanation: EXPLANATION,
        },
      ],
    },
  ],
})

export type Context = {
  lessonId: domain.LessonId
  publishedVersionId: domain.LessonVersionId
  tokens: {
    /** Staff who may read lessons. */
    teacher: string
  }
}

export const createContext = async (app: INestApplication): Promise<Context> => {
  const schools = app.get(SchoolsService)
  const courses = app.get(CoursesService)
  const lessons = app.get(LessonsService)
  const versions = app.get(LessonVersionsService)
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

  const published = await versions.create({
    lessonId: lesson.id,
    version: 1,
    status: 'published',
    publishedAt: new Date(),
    content: quizContent('Introduction'),
  })

  const teacher = await users.create({ email: faker.internet.email() })

  const token = async (userId: domain.UserId, p: domain.PermissionKey[]) =>
    (await auth.generateTokens(userId, p.length ? [{ sid: school.id, p }] : [])).accessToken

  return {
    lessonId: lesson.id,
    publishedVersionId: published.id,
    tokens: {
      teacher: await token(teacher.id, ['lessons:read']),
    },
  }
}
