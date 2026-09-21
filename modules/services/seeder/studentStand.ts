import type { CourseId, LessonId, LessonVersionId, RoleId, SchoolId, UserId } from '@vidya/domain'
import * as domain from '@vidya/domain'
import { Course, Lesson, LessonVersion, Role, School, User } from '@vidya/entities'
import { randomUUID } from 'crypto'
import { DataSource } from 'typeorm'

export interface StudentStandOptions {
  /** Who signs in as the student. The account is created if it does not exist. */
  readonly email: string

  /** Name of the school the joining link leads to. */
  readonly schoolName?: string

  /** The code that link carries, six characters of the school-code alphabet. */
  readonly schoolCode?: string

  /** Name of the course the school publishes. */
  readonly courseName?: string
}

export interface StudentStandResult {
  readonly schoolId: SchoolId
  readonly schoolCode: string
  readonly studentRoleId: RoleId
  readonly courseId: CourseId
  readonly lessonId: LessonId
  readonly lessonVersionId: LessonVersionId
  readonly userId: UserId
  readonly created: boolean
}

const DEFAULTS = {
  schoolName: 'Student Stand School',
  schoolCode: 'ABC123',
  courseName: 'Introduction',
  roleName: 'Student',
  lessonTitle: 'First lesson',
}

/** What a student may do: read the school around them, and nothing else. */
const STUDENT_PERMISSIONS: domain.PermissionKey[] = ['roles:read', 'schools:read', 'users:read']

const lessonContent = (): domain.LessonContent => ({
  schemaVersion: domain.LessonContentSchemaVersion,
  sections: [
    {
      id: domain.asId(randomUUID()),
      title: 'Welcome',
      assessment: 'none',
      blocks: [
        {
          id: domain.asId(randomUUID()),
          type: 'text',
          content: 'A lesson published so the student site has something to render.',
        },
      ],
    },
  ],
})

/**
 * Everything the student site needs before a person can open it.
 *
 * `bootstrap` makes a school and an owner, which is what the console needs.
 * The site needs three more things that nothing else in development creates: a
 * school carrying a joining code and a student role set, so `/j/<code>`
 * resolves and joining has a role to assign; a published course with a
 * published lesson, so the school is not empty once joined; and an account
 * holding no permission at all, because every account the console makes holds
 * some.
 *
 * Idempotent, like `bootstrap` and unlike `seed`: it adds what is missing and
 * leaves everything else alone. An account that already exists keeps the roles
 * it has — stripping them would revoke a membership the developer arranged on
 * purpose.
 */
export const seedStudentStand = async (
  dataSource: DataSource,
  options: StudentStandOptions,
): Promise<StudentStandResult> => {
  const email = options.email.trim().toLowerCase()
  if (email.length === 0) throw new Error('the student stand needs an email address')

  const code = domain.normaliseSchoolCode(options.schoolCode ?? DEFAULTS.schoolCode)
  if (!domain.isSchoolCode(code)) throw new Error(`not a school code: ${code}`)

  const schoolName = options.schoolName ?? DEFAULTS.schoolName
  const courseName = options.courseName ?? DEFAULTS.courseName

  return dataSource.transaction(async (manager) => {
    const schools = manager.getRepository(School)
    const roles = manager.getRepository(Role)
    const users = manager.getRepository(User)
    const courses = manager.getRepository(Course)
    const lessons = manager.getRepository(Lesson)
    const versions = manager.getRepository(LessonVersion)

    const existingSchool = await schools.findOneBy({ name: schoolName })
    const school = existingSchool ?? (await schools.save({ name: schoolName }))

    const existingRole = await roles.findOneBy({ name: DEFAULTS.roleName, schoolId: school.id })
    const studentRole =
      existingRole ??
      (await roles.save({
        name: DEFAULTS.roleName,
        description: 'Student of the school',
        permissions: STUDENT_PERMISSIONS,
        schoolId: school.id,
      }))

    // The code and the role set live on the school, and a school that has
    // neither cannot be joined at all: the link resolves to nothing and there
    // is no role to hand whoever follows it.
    const schoolCode = school.code ?? code
    school.code = schoolCode
    school.config = {
      defaultStudentRoleId: studentRole.id,
      studentRoleIds: [studentRole.id],
    }
    await schools.save(school)

    const existingCourse = await courses.findOneBy({ name: courseName, schoolId: school.id })
    const course =
      existingCourse ??
      (await courses.save({ name: courseName, schoolId: school.id, status: 'published' }))

    const existingLesson = await lessons.findOneBy({ courseId: course.id, lessonNumber: 1 })
    const lesson =
      existingLesson ??
      (await lessons.save({
        courseId: course.id,
        schoolId: school.id,
        lessonNumber: 1,
        title: DEFAULTS.lessonTitle,
      }))

    const existingVersion = await versions.findOneBy({ lessonId: lesson.id, version: 1 })
    const version =
      existingVersion ??
      (await versions.save({
        lessonId: lesson.id,
        version: 1,
        content: lessonContent(),
        status: 'published',
        publishedAt: new Date(),
      }))

    const existingUser = await users.findOneBy({ email })
    const user = existingUser ?? (await users.save({ email, name: email, roles: [] }))

    return {
      schoolId: school.id,
      schoolCode,
      studentRoleId: studentRole.id,
      courseId: course.id,
      lessonId: lesson.id,
      lessonVersionId: version.id,
      userId: user.id,
      created: !existingSchool || !existingCourse || !existingUser,
    }
  })
}
