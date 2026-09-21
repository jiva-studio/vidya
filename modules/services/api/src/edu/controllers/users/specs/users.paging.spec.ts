import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { UserAuthentication } from '@vidya/api/auth/utils'
import { CoursesController, UsersController } from '@vidya/api/edu/controllers'
import * as dto from '@vidya/api/edu/dto'
import { CoursesService, RolesService, UsersService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { testDatabase } from '@vidya/api/shared/datasources'
import { Role, User } from '@vidya/entities'

import { Context, createContext } from './context'

const itOnPostgres = testDatabase() === 'postgres' ? it : it.skip

describe('paging the lists', () => {
  let app: INestApplication
  let ctx: Context
  let users: UsersController
  let courses: CoursesController
  let usersService: UsersService
  let rolesService: RolesService
  let coursesService: CoursesService
  let staff: UserAuthentication
  let wide: UserAuthentication

  const userNamed = async (name: string, roleList: Role[]): Promise<User> =>
    await usersService.create({ name, email: faker.internet.email(), roles: roleList })

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
    users = app.get(UsersController)
    courses = app.get(CoursesController)
    usersService = app.get(UsersService)
    rolesService = app.get(RolesService)
    coursesService = app.get(CoursesService)

    const everything = await rolesService.create({
      name: 'Everything',
      description: 'Everything',
      schoolId: ctx.one.school.id,
      permissions: ['users:read', 'courses:read', 'roles:read', 'schools:read'],
    })
    staff = await ctx.authenticate(await userNamed('AAA Staff', [everything]))

    const alsoInTwo = await rolesService.create({
      name: 'Everything Two',
      description: 'Everything Two',
      schoolId: ctx.two.school.id,
      permissions: ['roles:read', 'schools:read', 'courses:read'],
    })
    wide = await ctx.authenticate(await userNamed('AAB Wide', [everything, alsoInTwo]))
  })

  afterEach(async () => {
    await app.close()
  })

  /* ------------------------------ 1. join count ----------------------------- */

  it('counts people, not joined rows, when somebody holds two roles in the school', async () => {
    const second = await rolesService.create({
      name: 'Second Role',
      description: 'Second Role',
      schoolId: ctx.one.school.id,
      permissions: ['users:read'],
    })
    await userNamed('BBB Two Roles', [ctx.one.roles.oneAdmin, second])

    const all = await users.getMany(new dto.GetUsersQuery(), staff)

    const query = new dto.GetUsersQuery()
    query.limit = 2
    const page = await users.getMany(query, staff)

    expect(all.total).toBe(all.items.length)
    expect(page.total).toBe(all.total)
    expect(page.items).toHaveLength(2)
    expect(new Set(page.items.map((item) => item.id)).size).toBe(2)
  })

  /* --------------------------- 2. scope intersection ------------------------ */

  it('returns nothing for a school the caller was not granted', async () => {
    await coursesService.create({ name: 'Elsewhere', schoolId: ctx.two.school.id })

    const [items, total] = await coursesService
      .scopedBy({ permissions: staff.permissions })
      .findAndCount({ where: { schoolId: ctx.two.school.id }, take: 10, skip: 0 })

    expect(items).toEqual([])
    expect(total).toBe(0)
  })

  /* ----------------------------- 3. fail closed ----------------------------- */

  it('returns nothing when the caller holds no scope, paged or not', async () => {
    await coursesService.create({ name: 'Hidden', schoolId: ctx.one.school.id })
    const nobody = await ctx.authenticate(ctx.misc.users.empty)
    const scoped = coursesService.scopedBy({ permissions: nobody.permissions })

    expect(await scoped.findAndCount({})).toEqual([[], 0])
    expect(await scoped.findAndCount({ take: 10, skip: 0 })).toEqual([[], 0])
  })

  /* -------------------------------- 4. ILIKE -------------------------------- */

  // pg-mem takes no backslash as LIKE's escape, so only the real planner can
  // say whether the term reaches it escaped.
  itOnPostgres('takes a wildcard in the search term literally', async () => {
    await userNamed('Pass 100% Course', [ctx.one.roles.oneAdmin])
    await userNamed('Pass 1000 Course', [ctx.one.roles.oneAdmin])
    await userNamed('axb', [ctx.one.roles.oneAdmin])
    await userNamed('a_b', [ctx.one.roles.oneAdmin])

    const percent = new dto.GetUsersQuery()
    percent.query = '100%'
    const underscore = new dto.GetUsersQuery()
    underscore.query = 'a_b'

    const byPercent = await users.getMany(percent, staff)
    const byUnderscore = await users.getMany(underscore, staff)

    expect(byPercent.items.map((item) => item.name)).toEqual(['Pass 100% Course'])
    expect(byUnderscore.items.map((item) => item.name)).toEqual(['a_b'])
  })

  it('does not let the search term change the query', async () => {
    await userNamed('Injection Target', [ctx.one.roles.oneAdmin])

    const query = new dto.GetUsersQuery()
    query.query = "%' OR 1=1 --"

    const found = await users.getMany(query, staff)

    expect(found.items).toEqual([])
    expect(found.total).toBe(0)
  })

  /* ----------------------- 5. ordering and 6. the others -------------------- */

  it('pages the courses list across the schools the caller may see', async () => {
    await coursesService.create({ name: 'Dup', schoolId: ctx.one.school.id })
    await coursesService.create({ name: 'Dup', schoolId: ctx.two.school.id })

    const seen: string[] = []
    for (let offset = 0; offset < 2; offset++) {
      const query = new dto.GetCoursesQuery()
      query.limit = 1
      query.offset = offset
      const page = await courses.getMany(query, wide)
      expect(page.total).toBe(2)
      expect(page.items).toHaveLength(1)
      seen.push(page.items[0].id)
    }

    expect(new Set(seen).size).toBe(2)
  })
})
