import type { CourseId, EnrollmentId, SchoolId, UserId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { beforeEach, describe, expect, it } from 'vitest'

import type { IDatabase, IEnrollmentRepository } from '@/ports'

import { fixedClock, openTestDatabase } from '../../../persistence/testing'
import { createSqlEnrollmentRepository } from '../enrollmentsRepository.sql'

const OWNER = '7b3d5e90-1c44-4a2b-8f61-2d9e0c4a5b73'
const SOMEBODY_ELSE = asId<UserId>('c4a9f1d6-2b83-4e57-9a10-6d5c3b7e4f28')
const COURSE = asId<CourseId>('b6d40e27-8c31-4a95-b7f2-0e5a1d38c624')
const SCHOOL = asId<SchoolId>('5c1f2e73-9a48-4c1d-b0e6-8f3a2d7c4915')
const REQUEST = asId<EnrollmentId>('4a7e2c96-0d13-4b58-9f26-3c8b1a5e70d4')

let db: IDatabase
let enrollments: IEnrollmentRepository

beforeEach(async () => {
  db = (await openTestDatabase()).db
  enrollments = createSqlEnrollmentRepository({ db, ownerId: () => OWNER, now: fixedClock })
})

/**
 * Who a locally written request is from.
 *
 * The server refuses a request that names nobody — it has no way to tell a
 * place asked for by this device from one asked for on somebody else's behalf —
 * and a refused row sits in the journal forever. The device is signed in as one
 * student and files every row under that identity, which is the only answer a
 * screen could give anyway.
 */
describe('a request written on the device', () => {
  it('is from the identity the device writes under when it names no student', async () => {
    await enrollments.request({ id: REQUEST, schoolId: SCHOOL, courseId: COURSE })

    expect(await enrollments.getById(REQUEST)).toMatchObject({ studentId: OWNER })
  })

  it('keeps the student it was given, so a caller that knows is not overruled', async () => {
    await enrollments.request({
      id: REQUEST,
      schoolId: SCHOOL,
      courseId: COURSE,
      studentId: SOMEBODY_ELSE,
    })

    expect(await enrollments.getById(REQUEST)).toMatchObject({ studentId: SOMEBODY_ELSE })
  })
})
