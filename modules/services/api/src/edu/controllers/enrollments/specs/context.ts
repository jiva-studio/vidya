import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import {
  CoursesService,
  GroupsService,
  SchoolsService,
  UsersService,
} from '@vidya/api/edu/services'
import * as domain from '@vidya/domain'

export type Context = {
  schoolId: string
  courseId: string
  groupId: string
  /** A group on a different course, used to check the assignment guard. */
  foreignGroupId: string
  studentId: string
  tokens: {
    /** A student: an account with no permissions at all. */
    student: string
    otherStudent: string
    moderator: string
    /** Staff who may read enrollments but not decide them. */
    observer: string
  }
}

export const createContext = async (app: INestApplication): Promise<Context> => {
  const schools = app.get(SchoolsService)
  const courses = app.get(CoursesService)
  const groups = app.get(GroupsService)
  const users = app.get(UsersService)
  const auth = app.get(AuthService)

  const school = await schools.create({ name: faker.company.name() })

  const course = await courses.create({
    name: 'Bhakti-shastri',
    learningType: 'group',
    schoolId: school.id,
  })

  const otherCourse = await courses.create({
    name: 'Bhakti-vaibhava',
    learningType: 'group',
    schoolId: school.id,
  })

  const group = await groups.create({
    courseId: course.id,
    schoolId: school.id,
    name: 'Morning',
  })

  const foreignGroup = await groups.create({
    courseId: otherCourse.id,
    schoolId: school.id,
    name: 'Evening on another course',
  })

  // Enrollments carry a foreign key to users, so the students have to exist.
  const student = await users.create({ email: faker.internet.email() })
  const otherStudent = await users.create({ email: faker.internet.email() })

  const token = async (userId: string, p: domain.PermissionKey[]) =>
    (await auth.generateTokens(userId, p.length ? [{ sid: school.id, p }] : [])).accessToken

  return {
    schoolId: school.id,
    courseId: course.id,
    groupId: group.id,
    foreignGroupId: foreignGroup.id,
    studentId: student.id,
    tokens: {
      student: await token(student.id, []),
      otherStudent: await token(otherStudent.id, []),
      moderator: await token((await users.create({ email: faker.internet.email() })).id, [
        'enrollments:read',
        'enrollments:moderate',
      ]),
      observer: await token((await users.create({ email: faker.internet.email() })).id, [
        'enrollments:read',
      ]),
    },
  }
}
