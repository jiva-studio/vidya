import type { SchoolId, SyncPayload } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { beforeEach, describe, expect, it } from 'vitest'

import type { IDatabase, ISchoolRepository } from '@/ports'

import { fixedClock, openTestDatabase } from '../../../persistence/testing'
import { createSqlSchoolRepository } from '../schoolsRepository.sql'
import { createSqlSyncApplyRepository } from '../syncApplyRepository.sql'

const OWNER = 'owner-1'
const DEVOTION = asId<SchoolId>('5c1f2e73-9a48-4c1d-b0e6-8f3a2d7c4915')
const BHAKTI = asId<SchoolId>('a1b2c3d4-0000-4000-8000-000000000001')

const school = (id: SchoolId, name: string, extra: SyncPayload = {}): SyncPayload => ({
  id,
  name,
  logoUrl: null,
  description: null,
  ...extra,
})

let db: IDatabase
let schools: ISchoolRepository
let seq = 0

/** Write a school the way a pull of the school scope writes it. */
const arrive = async (payload: SyncPayload): Promise<void> => {
  seq += 1
  const apply = createSqlSyncApplyRepository({ db, ownerId: () => OWNER, now: fixedClock })
  const hlc = `00178968920000${seq}:00000:server`

  await apply.applyRemote(
    'schools',
    { docId: payload.id as string, hlc, deleted: false, data: payload },
    hlc,
  )
}

beforeEach(async () => {
  seq = 0
  db = (await openTestDatabase()).db
  schools = createSqlSchoolRepository({ db, ownerId: () => OWNER })
})

/**
 * The school reaches the device the same way every other collection does —
 * through the apply path — and is read back through a port of its own.
 *
 * Nothing here filters on membership: a school on the device is readable
 * because it was downloaded, and reading what was downloaded is not a
 * permission question.
 */
describe('schools on the device', () => {
  it('holds what the school scope sent, presentation fields included', async () => {
    await arrive(
      school(DEVOTION, 'School of Devotion', {
        logoUrl: 'https://cdn.example.org/logos/devotion.png',
        description: 'Scripture, kirtan and practice.',
      }),
    )

    expect(await schools.getById(DEVOTION)).toEqual({
      id: DEVOTION,
      name: 'School of Devotion',
      logoUrl: 'https://cdn.example.org/logos/devotion.png',
      description: 'Scripture, kirtan and practice.',
    })
  })

  it('keeps a school that sent neither a logo nor a description', async () => {
    await arrive(school(BHAKTI, 'Bhakti School'))

    expect(await schools.getById(BHAKTI)).toEqual({
      id: BHAKTI,
      name: 'Bhakti School',
      logoUrl: null,
      description: null,
    })
  })

  it('lists every school this identity holds', async () => {
    await arrive(school(BHAKTI, 'Bhakti School'))
    await arrive(school(DEVOTION, 'School of Devotion'))

    expect((await schools.list()).map((item) => item.id).sort()).toEqual([BHAKTI, DEVOTION].sort())
  })

  it('answers with nothing for a school whose row has not arrived yet', async () => {
    // Scope positions advance independently, so a course can legitimately land
    // before the school it belongs to. The card draws a placeholder; the read
    // must not throw for it to get that far.
    expect(await schools.getById(DEVOTION)).toBeNull()
  })

  it('keeps one identity\u2019s schools out of another\u2019s reach', async () => {
    await arrive(school(DEVOTION, 'School of Devotion'))
    const other = createSqlSchoolRepository({ db, ownerId: () => 'owner-2' })

    expect(await other.getById(DEVOTION)).toBeNull()
    expect(await other.list()).toEqual([])
  })
})
