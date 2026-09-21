import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import {
  CoursesService,
  EnrollmentsService,
  GroupsService,
  SchoolsService,
  UsersService,
} from '@vidya/api/edu/services'
import * as domain from '@vidya/domain'
import { Enrollment } from '@vidya/entities'
import { DataSource } from 'typeorm'

/** One school, one course, one group, a student and someone who decides. */
export interface EnrollmentWorld {
  schoolId: domain.SchoolId
  courseId: domain.CourseId
  otherCourseId: domain.CourseId
  groupId: domain.GroupId
  studentId: domain.UserId
  moderatorId: domain.UserId
}

export const createEnrollmentWorld = async (app: INestApplication): Promise<EnrollmentWorld> => {
  const school = await app.get(SchoolsService).create({ name: faker.company.name() })

  const course = await app.get(CoursesService).create({
    name: 'Bhakti-shastri',
    learningType: 'group',
    schoolId: school.id,
  })

  const otherCourse = await app.get(CoursesService).create({
    name: 'Sanskrit for beginners',
    learningType: 'group',
    schoolId: school.id,
  })

  const group = await app.get(GroupsService).create({
    courseId: course.id,
    schoolId: school.id,
    name: 'Morning',
  })

  const student = await app.get(UsersService).create({ email: faker.internet.email() })
  const moderator = await app.get(UsersService).create({ email: faker.internet.email() })

  return {
    schoolId: school.id,
    courseId: course.id,
    otherCourseId: otherCourse.id,
    groupId: group.id,
    studentId: student.id,
    moderatorId: moderator.id,
  }
}

export type PlaceOverrides = Partial<{
  courseId: domain.CourseId
  groupId: domain.GroupId | null
  preferredGroupId: domain.GroupId | null
  preferredTimes: domain.PreferredTimes
  comment: string
  decidedById: domain.UserId
  decidedAt: Date
  archivedByStudentAt: Date | null
  archivedBySchoolAt: Date | null
  archivedBySchoolById: domain.UserId | null
}>

export const placeFor = (
  app: INestApplication,
  world: EnrollmentWorld,
  status: domain.EnrollmentStatus,
  overrides: PlaceOverrides = {},
): Promise<Enrollment> =>
  app.get(EnrollmentsService).create({
    courseId: world.courseId,
    studentId: world.studentId,
    schoolId: world.schoolId,
    status,
    ...overrides,
  })

export const reload = (app: INestApplication, id: domain.EnrollmentId): Promise<Enrollment> =>
  app.get(DataSource).getRepository(Enrollment).findOneBy({ id })
