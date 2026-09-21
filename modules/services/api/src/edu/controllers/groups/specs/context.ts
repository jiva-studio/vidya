import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import { CoursesService, GroupsService, SchoolsService } from '@vidya/api/edu/services'
import { newId } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'

export type Context = {
  schoolId: domain.SchoolId
  courseId: domain.CourseId
  groupId: domain.GroupId

  /** A course in a second school, to prove scoping rather than assume it. */
  otherSchoolId: domain.SchoolId
  otherCourseId: domain.CourseId
  otherGroupId: domain.GroupId

  tokens: {
    admin: string
    reader: string
    noPermissions: string
    otherSchool: string
  }
}

export const createContext = async (app: INestApplication): Promise<Context> => {
  const schools = app.get(SchoolsService)
  const courses = app.get(CoursesService)
  const groups = app.get(GroupsService)
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

  const group = await groups.create({
    courseId: course.id,
    schoolId: school.id,
    name: 'Morning group',
  })
  const otherGroup = await groups.create({
    courseId: otherCourse.id,
    schoolId: other.id,
    name: 'Evening group',
  })

  const token = async (schoolId: domain.SchoolId, p: domain.PermissionKey[]) =>
    (await auth.generateTokens(newId<domain.UserId>(), [{ sid: schoolId, p }])).accessToken

  return {
    schoolId: school.id,
    courseId: course.id,
    groupId: group.id,
    otherSchoolId: other.id,
    otherCourseId: otherCourse.id,
    otherGroupId: otherGroup.id,
    tokens: {
      admin: await token(school.id, [
        'groups:read',
        'groups:create',
        'groups:update',
        'groups:delete',
        'courses:read',
      ]),
      // Can see the course, so a refusal to create proves groups:create is missing
      // rather than the course lookup failing first.
      reader: await token(school.id, ['groups:read', 'courses:read']),
      noPermissions: (await auth.generateTokens(newId<domain.UserId>(), [])).accessToken,
      otherSchool: await token(other.id, [
        'groups:read',
        'groups:create',
        'groups:update',
        'groups:delete',
        'courses:read',
      ]),
    },
  }
}
