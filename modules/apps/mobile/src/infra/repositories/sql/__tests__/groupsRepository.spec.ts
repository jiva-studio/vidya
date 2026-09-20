import type { CourseId, GroupId, SchoolId, SyncPayload } from '@vidya/domain'
import { asId, parseIsoDateTime } from '@vidya/domain'
import { beforeEach, describe, expect, it } from 'vitest'

import type { IDatabase, IGroupRepository } from '@/ports'

import { fixedClock, openTestDatabase } from '../../../persistence/testing'
import { createSqlGroupRepository } from '../groupsRepository.sql'
import { createSqlSyncApplyRepository } from '../syncApplyRepository.sql'

const OWNER = '7b3d5e90-1c44-4a2b-8f61-2d9e0c4a5b73'
const SCHOOL = asId<SchoolId>('5c1f2e73-9a48-4c1d-b0e6-8f3a2d7c4915')
const SANSKRIT = asId<CourseId>('b6d40e27-8c31-4a95-b7f2-0e5a1d38c624')
const KIRTAN = asId<CourseId>('e9f81b40-5d27-4c36-a0b9-7f2e6c1d5a38')
const STARTS_AT = parseIsoDateTime('2026-10-01T05:00:00.000Z')

const MORNING = asId<GroupId>('1d6c8a35-4b29-4e07-9c58-3a7f2b6d1e40')
const EVENING = asId<GroupId>('2e7d9b46-5c3a-4f18-8d69-4b8a3c7e2f51')

const group = (id: GroupId, name: string, extra: SyncPayload = {}): SyncPayload => ({
  id,
  schoolId: SCHOOL,
  courseId: SANSKRIT,
  name,
  description: null,
  startsAt: null,
  status: 'pending',
  ...extra,
})

let db: IDatabase
let groups: IGroupRepository
let seq = 0

/**
 * Write a group the way a pull of the school scope writes it.
 *
 * The rows ride the school scope: a student who holds no place holds no course
 * scope either, and the catalogue is read before there is a place to hold.
 */
const arrive = async (payload: SyncPayload): Promise<void> => {
  seq += 1
  const apply = createSqlSyncApplyRepository({ db, ownerId: () => OWNER, now: fixedClock })
  const hlc = `00178968920000${seq}:00000:server`

  await apply.applyRemote(
    'groups',
    { docId: payload.id as string, hlc, deleted: false, data: payload },
    hlc,
    { kind: 'school', id: SCHOOL },
  )
}

beforeEach(async () => {
  seq = 0
  db = (await openTestDatabase()).db
  groups = createSqlGroupRepository({ db, ownerId: () => OWNER })
})

describe('the groups of a course', () => {
  it('lists the ones still taking students', async () => {
    await arrive(group(MORNING, 'Morning group'))
    await arrive(group(EVENING, 'Evening group'))

    expect((await groups.listRecruitingByCourse(SANSKRIT)).map((item) => item.id).sort()).toEqual(
      [MORNING, EVENING].sort(),
    )
  })

  it('drops a group once the school has started it', async () => {
    await arrive(group(MORNING, 'Morning group'))
    await arrive(group(MORNING, 'Morning group', { status: 'active', startsAt: STARTS_AT }))

    expect(await groups.listRecruitingByCourse(SANSKRIT)).toEqual([])
  })

  it('drops a group the school has closed', async () => {
    await arrive(group(MORNING, 'Morning group', { status: 'inactive' }))

    expect(await groups.listRecruitingByCourse(SANSKRIT)).toEqual([])
  })

  it('leaves out the groups of another course', async () => {
    await arrive(group(MORNING, 'Morning group'))
    await arrive(group(EVENING, 'Evening kirtan', { courseId: KIRTAN }))

    expect((await groups.listRecruitingByCourse(SANSKRIT)).map((item) => item.id)).toEqual([
      MORNING,
    ])
  })

  it('carries what the card shows: name, description and the start', async () => {
    await arrive(
      group(MORNING, 'Morning group', {
        description: 'Six in the morning, twice a week.',
        startsAt: STARTS_AT,
        status: 'active',
      }),
    )

    expect(await groups.getById(MORNING)).toEqual({
      id: MORNING,
      schoolId: SCHOOL,
      courseId: SANSKRIT,
      name: 'Morning group',
      description: 'Six in the morning, twice a week.',
      startsAt: STARTS_AT,
      status: 'active',
    })
  })

  it('hands back a started group asked for by name', async () => {
    // An accepted student's own group is theirs whatever its status, or the
    // place they hold disappears the day recruitment closes.
    await arrive(group(MORNING, 'Morning group', { status: 'active' }))

    expect(await groups.getById(MORNING)).toMatchObject({ id: MORNING, status: 'active' })
  })

  it('answers with nothing for a group whose row has not arrived yet', async () => {
    expect(await groups.getById(MORNING)).toBeNull()
  })

  it('keeps one identity’s groups out of another’s reach', async () => {
    await arrive(group(MORNING, 'Morning group'))
    const other = createSqlGroupRepository({ db, ownerId: () => 'owner-2' })

    expect(await other.getById(MORNING)).toBeNull()
    expect(await other.listRecruitingByCourse(SANSKRIT)).toEqual([])
  })
})
