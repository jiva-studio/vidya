import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import {
  CoursesService,
  LessonsService,
  LessonVersionsService,
  SchoolsService,
} from '@vidya/api/edu/services'
import * as domain from '@vidya/domain'

export type Context = {
  schoolId: string
  courseId: string
  lessonId: string
  draftVersionId: string
  tokens: {
    /** May edit content but may not publish it. */
    editor: string
    /** May edit and publish. */
    publisher: string
    reader: string
    otherSchool: string
  }
}

export const createContext = async (app: INestApplication): Promise<Context> => {
  const schools = app.get(SchoolsService)
  const courses = app.get(CoursesService)
  const lessons = app.get(LessonsService)
  const versions = app.get(LessonVersionsService)
  const auth = app.get(AuthService)

  const school = await schools.create({ name: faker.company.name() })
  const other = await schools.create({ name: faker.company.name() })

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

  const draft = await versions.create({
    lessonId: lesson.id,
    version: 1,
    status: 'draft',
    content: { sections: [] },
  })

  const token = async (schoolId: string, p: domain.PermissionKey[]) =>
    (await auth.generateTokens(faker.string.uuid(), [{ sid: schoolId, p }])).accessToken

  return {
    schoolId: school.id,
    courseId: course.id,
    lessonId: lesson.id,
    draftVersionId: draft.id,
    tokens: {
      editor: await token(school.id, ['lessons:read', 'lessons:update']),
      publisher: await token(school.id, ['lessons:read', 'lessons:update', 'lessons:publish']),
      reader: await token(school.id, ['lessons:read']),
      otherSchool: await token(other.id, ['lessons:read', 'lessons:update', 'lessons:publish']),
    },
  }
}
