import { Course, Lesson, LessonVersion, School, User } from '@vidya/entities'
import { DataSource } from 'typeorm'

import { seedStudentStand } from '../studentStand'
import { testingDataSource } from './testing.datasource'

const EMAIL = 'student@example.com'

describe('seedStudentStand', () => {
  let dataSource: DataSource

  const schools = () => dataSource.getRepository(School)
  const courses = () => dataSource.getRepository(Course)
  const lessons = () => dataSource.getRepository(Lesson)
  const versions = () => dataSource.getRepository(LessonVersion)
  const users = () => dataSource.getRepository(User)

  beforeEach(async () => {
    dataSource = await testingDataSource()
  })

  afterEach(async () => {
    await dataSource.destroy()
  })

  describe('the school a joining link leads to', () => {
    it('carries a code, so /j/<code> resolves to it', async () => {
      const result = await seedStudentStand(dataSource, { email: EMAIL })

      const school = await schools().findOneBy({ id: result.schoolId })

      expect(school.code).toBe(result.schoolCode)
      expect(result.schoolCode).toHaveLength(6)
    })

    it('takes the code it is given, upper-cased', async () => {
      const result = await seedStudentStand(dataSource, { email: EMAIL, schoolCode: 'xy7z9q' })

      expect(result.schoolCode).toBe('XY7Z9Q')
    })

    it('refuses a code outside the school-code alphabet', async () => {
      await expect(
        seedStudentStand(dataSource, { email: EMAIL, schoolCode: 'ABCDEI' }),
      ).rejects.toThrow('not a school code')
    })

    it('names a student role to assign to whoever follows the link', async () => {
      const result = await seedStudentStand(dataSource, { email: EMAIL })

      const school = await schools().findOneBy({ id: result.schoolId })

      expect(school.config.defaultStudentRoleId).toBe(result.studentRoleId)
      expect(school.config.studentRoleIds).toEqual([result.studentRoleId])
    })
  })

  describe('what the school teaches', () => {
    it('publishes the course, so a joined student can see it', async () => {
      const result = await seedStudentStand(dataSource, { email: EMAIL })

      expect((await courses().findOneBy({ id: result.courseId })).status).toBe('published')
    })

    it('gives the course a lesson with a published version carrying content', async () => {
      const result = await seedStudentStand(dataSource, { email: EMAIL })

      const lesson = await lessons().findOneBy({ id: result.lessonId })
      const version = await versions().findOneBy({ id: result.lessonVersionId })

      expect(lesson.courseId).toBe(result.courseId)
      expect(version.lessonId).toBe(result.lessonId)
      expect(version.status).toBe('published')
      expect(version.content.sections).toHaveLength(1)
    })
  })

  describe('the student', () => {
    it('holds no role at all, which is what joining has to start from', async () => {
      const result = await seedStudentStand(dataSource, { email: EMAIL })

      const user = await users().findOne({
        where: { id: result.userId },
        relations: { roles: true },
      })

      expect(user.email).toBe(EMAIL)
      expect(user.roles).toEqual([])
    })

    it('lower-cases the address, so the same person is one account', async () => {
      const result = await seedStudentStand(dataSource, { email: '  Student@Example.COM ' })

      expect((await users().findOneBy({ id: result.userId })).email).toBe(EMAIL)
    })

    it('refuses an empty address', async () => {
      await expect(seedStudentStand(dataSource, { email: '   ' })).rejects.toThrow(
        'needs an email address',
      )
    })
  })

  describe('running it twice', () => {
    it('adds nothing the second time and reports that', async () => {
      const first = await seedStudentStand(dataSource, { email: EMAIL })
      const second = await seedStudentStand(dataSource, { email: EMAIL })

      expect(second.schoolId).toBe(first.schoolId)
      expect(second.courseId).toBe(first.courseId)
      expect(second.lessonVersionId).toBe(first.lessonVersionId)
      expect(second.userId).toBe(first.userId)
      expect(second.created).toBe(false)
      expect(await courses().count()).toBe(1)
      expect(await lessons().count()).toBe(1)
    })

    it('keeps the code the school already had rather than overwriting it', async () => {
      const first = await seedStudentStand(dataSource, { email: EMAIL, schoolCode: 'AAAAAA' })
      const second = await seedStudentStand(dataSource, { email: EMAIL, schoolCode: 'BBBBBB' })

      expect(second.schoolCode).toBe(first.schoolCode)
    })
  })
})
