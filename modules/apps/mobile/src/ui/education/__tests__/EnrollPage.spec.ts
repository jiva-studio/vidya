// @vitest-environment jsdom
import type { IOutboxRepository } from '@vidya/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app', async () => (await import('./localScreens')).appDouble)
vi.mock('@capacitor/network', async () => (await import('./localScreens')).capacitorNetworkDouble)

import { AsyncButton } from '@/design'
import { fixedClock, openTestDatabase } from '@/infra/persistence/testing'
import {
  createSqlBlockStateRepository,
  createSqlEnrollmentRepository,
  createSqlHomeworkRepository,
  createSqlOutboxRepository,
  createSqlSyncApplyRepository,
  withSyncJournaling,
} from '@/infra/repositories'

import EnrollPage from '../pages/EnrollPage.vue'
import {
  aCourse,
  aSchool,
  COURSE_ID,
  mountPage,
  OWNER_ID,
  repositories,
  resetLocalScreens,
  seed,
  settle,
} from './localScreens'

let outbox: IOutboxRepository

/** The real device stack, so what the screen writes is what SQLite holds. */
async function openDevice(): Promise<void> {
  const { db } = await openTestDatabase()
  const ownerId = () => OWNER_ID

  outbox = createSqlOutboxRepository({ db, now: fixedClock })
  const apply = createSqlSyncApplyRepository({ db, ownerId, now: fixedClock })

  const journaled = withSyncJournaling(
    {
      enrollments: createSqlEnrollmentRepository({ db, ownerId, now: fixedClock }),
      homework: createSqlHomeworkRepository({ db, ownerId, now: fixedClock }),
      blockStates: createSqlBlockStateRepository({ db, ownerId, now: fixedClock }),
    },
    {
      db,
      outbox,
      apply,
      deviceId: async () => 'device-8f2a6c14',
      ownerId,
      nowMs: () => 1_789_689_200_000,
    },
  )

  Object.assign(repositories, journaled)
}

beforeEach(async () => {
  resetLocalScreens()
  seed.schools.push(aSchool())
  seed.courses.push(aCourse())
  await openDevice()
})

async function pressEnrol(): Promise<void> {
  const wrapper = await mountPage(EnrollPage, { courseId: COURSE_ID })
  await settle()
  wrapper.findComponent(AsyncButton).vm.$emit('click')
  await settle()
}

/**
 * Enrolling is a request written down, not a call placed.
 *
 * The server applier for it already exists, so the screen has nothing to gain
 * from posting: a row in the outbox reaches the school on the next run and
 * survives a tunnel, an aeroplane and a flat battery, which a post does not.
 */
describe('asking to join a course', () => {
  it('writes the request to the device', async () => {
    await pressEnrol()

    expect(await repositories.enrollments.getByCourse(COURSE_ID)).toMatchObject({
      courseId: COURSE_ID,
      status: 'pending',
    })
  })

  it('journals it for the next run', async () => {
    await pressEnrol()

    const pending = await outbox.listPending({ ownerId: OWNER_ID })

    expect(pending.map((row) => ({ collection: row.collection, op: row.op }))).toEqual([
      { collection: 'enrollments', op: 'upsert' },
    ])
  })

  it('sends nothing over the network while doing it', async () => {
    const network = vi.spyOn(globalThis, 'fetch')

    await pressEnrol()

    expect(network).not.toHaveBeenCalled()
  })

  it('works with the radio off, which is the point of journaling it', async () => {
    const { setOnline } = await import('./localScreens')
    setOnline(false)

    await pressEnrol()

    expect(await outbox.listPending({ ownerId: OWNER_ID })).toHaveLength(1)
  })
})
