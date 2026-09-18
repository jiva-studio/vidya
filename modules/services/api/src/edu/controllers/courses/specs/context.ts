import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { AuthService } from '@vidya/api/auth/services'
import { CoursesService, SchoolsService } from '@vidya/api/edu/services'
import { newId } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import { School } from '@vidya/entities'

/**
 * Two schools that know nothing about each other.
 *
 * Almost every case in these suites is about the boundary between them: a token
 * for one school must not reach the other's rows, whatever it asks for.
 */
export type Context = {
  one: {
    school: School
    courseId: string
    tokens: { admin: string; readonly: string }
  }
  two: {
    school: School
    courseId: string
    tokens: { admin: string }
  }
  tokens: { noPermissions: string }
}

export const createContext = async (app: INestApplication): Promise<Context> => {
  const schools = app.get(SchoolsService)
  const courses = app.get(CoursesService)
  const auth = app.get(AuthService)

  const schoolOne = await schools.create({ name: faker.company.name() })
  const schoolTwo = await schools.create({ name: faker.company.name() })

  const courseOne = await courses.create({
    name: 'Bhakti-shastri',
    description: 'A one year course',
    learningType: 'group',
    schoolId: schoolOne.id,
  })

  const courseTwo = await courses.create({
    name: 'Bhakti-vaibhava',
    learningType: 'individual',
    schoolId: schoolTwo.id,
  })

  const all = ['courses:create', 'courses:read', 'courses:update', 'courses:delete'] as const

  return {
    one: {
      school: schoolOne,
      courseId: courseOne.id,
      tokens: {
        admin: (
          await auth.generateTokens(newId<domain.UserId>(), [{ sid: schoolOne.id, p: [...all] }])
        ).accessToken,
        readonly: (
          await auth.generateTokens(newId<domain.UserId>(), [
            { sid: schoolOne.id, p: ['courses:read'] },
          ])
        ).accessToken,
      },
    },
    two: {
      school: schoolTwo,
      courseId: courseTwo.id,
      tokens: {
        admin: (
          await auth.generateTokens(newId<domain.UserId>(), [{ sid: schoolTwo.id, p: [...all] }])
        ).accessToken,
      },
    },
    tokens: {
      noPermissions: (await auth.generateTokens(newId<domain.UserId>(), [])).accessToken,
    },
  }
}
