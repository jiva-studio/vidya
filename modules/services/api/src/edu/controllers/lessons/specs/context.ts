import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import {
  CoursesService,
  LessonsService,
  LessonVersionsService,
  SchoolsService,
} from '@vidya/api/edu/services'
import { newId } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import { emptyLessonContent } from '@vidya/domain'

export type Context = {
  schoolId: domain.SchoolId
  courseId: domain.CourseId
  lessonId: domain.LessonId
  draftVersionId: domain.LessonVersionId

  /** A course in a second school, so scoping is proved rather than assumed. */
  otherCourseId: domain.CourseId
  otherLessonId: domain.LessonId
  tokens: {
    /** May edit content but may not publish it. */
    editor: string
    /** May edit and publish. */
    publisher: string
    reader: string
    otherSchool: string

    /** Sees courses and lessons but may not author them. */
    author: string
    noPermissions: string
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

  const otherCourse = await courses.create({
    name: 'Bhakti-vaibhava',
    learningType: 'group',
    schoolId: other.id,
  })

  const otherLesson = await lessons.create({
    courseId: otherCourse.id,
    schoolId: other.id,
    lessonNumber: 1,
    title: 'Elsewhere',
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
    content: emptyLessonContent(),
  })

  const token = async (schoolId: domain.SchoolId, p: domain.PermissionKey[]) =>
    (await auth.generateTokens(newId<domain.UserId>(), [{ sid: schoolId, p }])).accessToken

  return {
    schoolId: school.id,
    courseId: course.id,
    lessonId: lesson.id,
    draftVersionId: draft.id,
    otherCourseId: otherCourse.id,
    otherLessonId: otherLesson.id,
    tokens: {
      editor: await token(school.id, ['lessons:read', 'lessons:update']),
      publisher: await token(school.id, ['lessons:read', 'lessons:update', 'lessons:publish']),
      // Sees the course too, so a create refusal proves lessons:create is missing
      // rather than the course lookup failing first.
      reader: await token(school.id, ['lessons:read', 'courses:read']),
      otherSchool: await token(other.id, ['lessons:read', 'lessons:update', 'lessons:publish']),
      author: await token(school.id, [
        'courses:read',
        'lessons:read',
        'lessons:create',
        'lessons:update',
        'lessons:delete',
      ]),
      noPermissions: (await auth.generateTokens(newId<domain.UserId>(), [])).accessToken,
    },
  }
}
