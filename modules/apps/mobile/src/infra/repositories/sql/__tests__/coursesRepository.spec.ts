import type { CourseId, SchoolId, SyncPayload } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { beforeEach, describe, expect, it } from 'vitest'

import type { ICourseRepository, IDatabase } from '@/ports'

import { fixedClock, openTestDatabase } from '../../../persistence/testing'
import { createSqlCourseRepository } from '../coursesRepository.sql'
import { createSqlSyncApplyRepository } from '../syncApplyRepository.sql'

const OWNER = '7b3d5e90-1c44-4a2b-8f61-2d9e0c4a5b73'
const SCHOOL = asId<SchoolId>('5c1f2e73-9a48-4c1d-b0e6-8f3a2d7c4915')
const SANSKRIT = asId<CourseId>('b6d40e27-8c31-4a95-b7f2-0e5a1d38c624')
const KIRTAN = asId<CourseId>('e9f81b40-5d27-4c36-a0b9-7f2e6c1d5a38')

const course = (id: CourseId, name: string, extra: SyncPayload = {}): SyncPayload => ({
  id,
  schoolId: SCHOOL,
  name,
  description: null,
  learningType: 'individual',
  status: 'published',
  ...extra,
})

let db: IDatabase
let courses: ICourseRepository
let seq = 0

/**
 * Write a course the way a pull of the school scope writes it.
 *
 * The cards ride the school scope: a student who holds no place holds no course
 * scope either, and the catalogue is read before there is a place to hold.
 */
const arrive = async (payload: SyncPayload): Promise<void> => {
  seq += 1
  const apply = createSqlSyncApplyRepository({ db, ownerId: () => OWNER, now: fixedClock })
  const hlc = `00178968920000${seq}:00000:server`

  await apply.applyRemote(
    'courses',
    { docId: payload.id as string, hlc, deleted: false, data: payload },
    hlc,
    { kind: 'school', id: SCHOOL },
  )
}

beforeEach(async () => {
  seq = 0
  db = (await openTestDatabase()).db
  courses = createSqlCourseRepository({ db, ownerId: () => OWNER })
})

/**
 * A course on the device, and whether its school has published it.
 *
 * A course is created as a draft, so the status is the difference between a
 * course the school is still writing and one it is offering. A reader that
 * cannot see the status cannot tell them apart, and every screen that draws a
 * catalogue draws the drafts with the rest.
 */
describe('courses on the device', () => {
  it('holds the status the school scope sent', async () => {
    await arrive(course(SANSKRIT, 'Sanskrit for beginners', { status: 'draft' }))

    expect(await courses.getById(SANSKRIT)).toMatchObject({ status: 'draft' })
  })

  it('holds the status of a published course too', async () => {
    await arrive(course(KIRTAN, 'Kirtan'))

    expect(await courses.getById(KIRTAN)).toMatchObject({ status: 'published' })
  })

  it('carries the status on every course it lists', async () => {
    await arrive(course(SANSKRIT, 'Sanskrit for beginners', { status: 'draft' }))
    await arrive(course(KIRTAN, 'Kirtan'))

    // Listed by name, so Kirtan comes first.
    expect(await courses.list()).toEqual([
      expect.objectContaining({ id: KIRTAN, status: 'published' }),
      expect.objectContaining({ id: SANSKRIT, status: 'draft' }),
    ])
  })
})
