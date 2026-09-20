// @vitest-environment jsdom
import type {
  EnrollmentId,
  EnrollmentStatus,
  IOutboxRepository,
  ISyncApplyRepository,
} from '@vidya/domain'
import { EnrollmentStatuses } from '@vidya/domain'
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
  ENROLLMENT_ID,
  mintedIds,
  mountPage,
  navigations,
  OWNER_ID,
  repositories,
  resetLocalScreens,
  SCHOOL_ID,
  seed,
  settle,
} from './localScreens'

let outbox: IOutboxRepository
let apply: ISyncApplyRepository

/** The real device stack, so what the screen writes is what SQLite holds. */
async function openDevice(): Promise<void> {
  const { db } = await openTestDatabase()
  const ownerId = () => OWNER_ID

  outbox = createSqlOutboxRepository({ db, now: fixedClock })
  apply = createSqlSyncApplyRepository({ db, ownerId, now: fixedClock })

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

/** Presses the button `taps` times before letting anything settle. */
async function pressEnrol(taps = 1): Promise<void> {
  const wrapper = await mountPage(EnrollPage, { courseId: COURSE_ID })
  await settle()

  const button = wrapper.findComponent(AsyncButton)
  for (let tap = 0; tap < taps; tap += 1) button.vm.$emit('click')

  await settle()
}

const SERVER_HLC = '001789689200000:00000:server'

/** A place the school has already answered on, written the way a pull writes it. */
async function placeOnTheDevice(status: EnrollmentStatus): Promise<EnrollmentId> {
  await apply.applyRemote(
    'enrollments',
    {
      docId: ENROLLMENT_ID,
      hlc: SERVER_HLC,
      deleted: false,
      data: {
        id: ENROLLMENT_ID,
        schoolId: SCHOOL_ID,
        courseId: COURSE_ID,
        studentId: OWNER_ID,
        status,
        createdAt: '2026-09-18T07:20:00.000Z',
      },
    },
    SERVER_HLC,
    // An enrolment travels on the student's own scope, not the course's.
    { kind: 'user', id: OWNER_ID },
  )

  return ENROLLMENT_ID
}

const liveEnrollments = () => repositories.enrollments.list()

const journaled = () => outbox.listPending({ ownerId: OWNER_ID })

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

    expect(await repositories.enrollments.getLiveByCourse(COURSE_ID)).toMatchObject({
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

/**
 * One course holds one place, and asking twice must not look like two.
 *
 * The server keys a place by course and student, so a second document was never
 * going to become a second place there. The harm is local and immediate:
 * `getLiveByCourse` answers with the newest live row, so a fresh `pending` hides an
 * accepted place, and a student who is already studying is told they are
 * waiting to be let in.
 *
 * Two separate guards stand between the student and that, and they catch
 * different things. Reading the place first catches the student who comes back
 * to a course they already hold. It does not catch two taps on one screen: both
 * handlers read before either writes, both find nothing, and both write. That
 * one is caught by refusing to enter the handler a second time — and the button
 * cannot do it, because the second tap lands before the render that disables it.
 */
/**
 * Whether a place already on the device stops a second request for the course.
 *
 * Keyed by the domain's own list rather than spelled out beside the cases, so
 * a state added there has to be answered here instead of quietly sitting out
 * the run. `pending` is left out of the cases below because the two taps that
 * create it are their own tests.
 */
const STOPS_A_SECOND_REQUEST: Record<EnrollmentStatus, boolean> = {
  pending: true,
  accepted: true,
  declined: false,
  revoked: false,
  withdrawn: false,
}

const alreadyHeld = EnrollmentStatuses.filter(
  (status) => status !== 'pending' && STOPS_A_SECOND_REQUEST[status],
)

const finished = EnrollmentStatuses.filter((status) => !STOPS_A_SECOND_REQUEST[status])

describe('asking twice for the same course', () => {
  it('writes one request when the button is tapped twice before it can disable itself', async () => {
    await pressEnrol(2)

    expect(await liveEnrollments()).toHaveLength(1)
  })

  it('journals one row for those two taps', async () => {
    await pressEnrol(2)

    expect(await journaled()).toHaveLength(1)
  })

  it.each(alreadyHeld)(
    'writes nothing when the course already holds a %s place',
    async (status) => {
      await placeOnTheDevice(status)

      await pressEnrol()

      expect(await journaled()).toEqual([])
    },
  )

  it.each(alreadyHeld)(
    'keeps the one %s place rather than laying a pending one over it',
    async (status) => {
      await placeOnTheDevice(status)

      await pressEnrol()

      expect(await liveEnrollments()).toMatchObject([{ id: ENROLLMENT_ID, status }])
    },
  )

  it.each(alreadyHeld)('opens the %s place it found instead of asking again', async (status) => {
    const held = await placeOnTheDevice(status)

    await pressEnrol()

    expect(navigations.at(-1)).toEqual({ name: 'my-enrollment', params: { id: held } })
  })

  it.each(finished)('asks again when the course holds only a %s request', async (status) => {
    // A finished request is history, and history holds no place: the second
    // request is a new row rather than a rewrite of the old one.
    const held = await placeOnTheDevice(status)

    await pressEnrol()

    const live = await repositories.enrollments.getLiveByCourse(COURSE_ID)
    expect(live?.id).not.toBe(held)
    expect(live?.status).toBe('pending')
  })

  it('sends a student with no place to the confirmation instead', async () => {
    await pressEnrol()

    expect(navigations.at(-1)).toEqual({
      name: 'enroll-completed',
      params: { id: COURSE_ID },
    })
  })

  it('lets a student who withdrew their own request make it again', async () => {
    // A finished request holds no place, so the screen does not find one.
    // Without that, a student who changed their mind could never change it back.
    const withdrawn = await placeOnTheDevice('pending')
    await repositories.enrollments.withdraw(withdrawn)

    await pressEnrol()

    const live = await liveEnrollments()
    expect(live).toHaveLength(1)
    expect(live[0]!.id).not.toBe(withdrawn)
    expect(live[0]!.id).toBe(mintedIds.at(-1))
    expect(live[0]!.status).toBe('pending')
  })
})
