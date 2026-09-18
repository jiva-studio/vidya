import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { testDatabase } from '@vidya/api/shared/datasources'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'

import { Context, createContext } from './context'

/**
 * Enrolling is a read-then-write: the handler checks for an existing enrolment
 * and inserts if it finds none. Two requests arriving together can both pass
 * the check before either inserts, and only the unique index stops the second.
 *
 * pg-mem does not model concurrent transactions, so this can only be asked of a
 * real server.
 */
const describeOnPostgres = testDatabase() === 'postgres' ? describe : describe.skip

describeOnPostgres('/edu/enrollments under concurrency', () => {
  let app: INestApplication
  let ctx: Context

  beforeEach(async () => {
    app = await createTestingApp()
    ctx = await createContext(app)
  })

  afterAll(async () => {
    await app.close()
  })

  it('creates exactly one enrolment when the same student asks twice at once', async () => {
    const enrol = () =>
      request(app.getHttpServer())
        .post(protocol.Routes().edu.enrollments.create())
        .auth(ctx.tokens.student, { type: 'bearer' })
        .send({ courseId: ctx.courseId })

    const responses = await Promise.all([enrol(), enrol()])

    // One wins. The other must be refused — never a second row, and never a
    // raw 500 leaking the constraint name.
    const statuses = responses.map((r) => r.status).sort()
    expect(statuses[0]).toBe(201)
    expect(statuses[1]).not.toBe(201)
    expect(statuses[1]).toBeLessThan(500)

    const list = await request(app.getHttpServer())
      .get(protocol.Routes().edu.enrollments.find())
      .auth(ctx.tokens.student, { type: 'bearer' })
      .expect(200)

    expect(list.body.items).toHaveLength(1)
  })
})
