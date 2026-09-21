// @vitest-environment jsdom
import { IonItemOption } from '@ionic/vue'
import type {
  EnrollmentId,
  EnrollmentStatus,
  IOutboxRepository,
  ISyncApplyRepository,
} from '@vidya/domain'
import { asId, parseIsoDateTime } from '@vidya/domain'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app', async () => (await import('./localScreens')).appDouble)
vi.mock('@capacitor/network', async () => (await import('./localScreens')).capacitorNetworkDouble)

import { fixedClock, openTestDatabase } from '@/infra/persistence/testing'
import {
  createSqlBlockStateRepository,
  createSqlEnrollmentRepository,
  createSqlHomeworkRepository,
  createSqlOutboxRepository,
  createSqlSyncApplyRepository,
  withSyncJournaling,
} from '@/infra/repositories'
import type { IEnrollmentRepository } from '@/ports'
import { EnrollmentsListItem } from '@/ui/education'
import { FakeSyncServer, USER_SCOPE } from '@/usecases/sync/__tests__/fakeSyncServer'
import { openHarness } from '@/usecases/sync/__tests__/harness'

import MyEnrollmentsPage from '../pages/MyEnrollmentsPage.vue'
import {
  aCourse,
  aGroup,
  anEnrollment,
  aSchool,
  COURSE_ID,
  ENROLLMENT_ID,
  GROUP_ID,
  mountPage,
  OWNER_ID,
  repositories,
  resetLocalScreens,
  SCHOOL_ID,
  seed,
  settle,
} from './localScreens'
import { type StagedOverlays, stageOverlays } from './overlayDoubles'

/** What the three swipe actions read, in the language the screens are tested in. */
const CANCEL_THE_REQUEST = 'Cancel the request'
const LEAVE_THE_COURSE = 'Leave the course'
const REMOVE_FROM_THE_LIST = 'Remove from the list'

const SECOND_ID = asId<EnrollmentId>('2b6f1d48-9c07-4e35-8a12-5d3b7e0c9f64')

const LAST_YEAR = '2025-09-01T07:20:00.000Z'
const THIS_YEAR = '2026-09-18T07:20:00.000Z'

let overlays: StagedOverlays

beforeEach(() => {
  resetLocalScreens()
  seed.schools.push(aSchool())
  seed.courses.push(aCourse())
  overlays = stageOverlays()
})

afterEach(async () => {
  await overlays.closeAll()
  vi.restoreAllMocks()
})

const openList = async (): Promise<VueWrapper> => {
  const wrapper = await mountPage(MyEnrollmentsPage)
  await settle()

  return wrapper
}

const rowsOn = (wrapper: VueWrapper) => wrapper.findAllComponents(EnrollmentsListItem)

/** Everything the swipe on one row offers, read as one line. */
const actionsOn = (wrapper: VueWrapper, index = 0): string =>
  rowsOn(wrapper)
    [index].findAll('ion-item-option')
    .map((option) => option.text())
    .join(' | ')

async function swipe(wrapper: VueWrapper, label: string, index = 0): Promise<void> {
  const option = rowsOn(wrapper)
    [index].findAll('ion-item-option')
    .find((candidate) => candidate.text().includes(label))

  if (option === undefined) throw new Error(`no swipe action reading "${label}" on row ${index}`)

  await option.trigger('click')
  await settle()
}

/* -------------------------------------------------------------------------- */
/*                                 The swipe                                  */
/* -------------------------------------------------------------------------- */

/**
 * A request that is still running is answered, not tidied away.
 *
 * Putting a row away is a student saying "I have read this and I am done with
 * it", and a request nobody has answered yet is not something to be done with:
 * hiding it leaves the student waiting for a school that is waiting for them.
 * So the swipe on a live row offers the decision instead — take the request
 * back, or hand the place back — and the school hears about either.
 */
describe('the swipe offers what the row is ready for', () => {
  it('offers to take back a request the school has not answered', async () => {
    seed.enrollments.push(anEnrollment({ status: 'pending' }))

    const wrapper = await openList()

    expect(actionsOn(wrapper)).toContain(CANCEL_THE_REQUEST)
    expect(actionsOn(wrapper)).not.toContain(REMOVE_FROM_THE_LIST)
  })

  it('offers to hand back a place the student holds', async () => {
    seed.enrollments.push(anEnrollment({ status: 'accepted' }))

    const wrapper = await openList()

    expect(actionsOn(wrapper)).toContain(LEAVE_THE_COURSE)
    expect(actionsOn(wrapper)).not.toContain(REMOVE_FROM_THE_LIST)
  })

  it.each(['declined', 'revoked'] as const)(
    'offers to put a %s request out of the list',
    async (status) => {
      seed.enrollments.push(anEnrollment({ status }))

      const wrapper = await openList()

      expect(actionsOn(wrapper)).toContain(REMOVE_FROM_THE_LIST)
      expect(actionsOn(wrapper)).not.toContain(CANCEL_THE_REQUEST)
      expect(actionsOn(wrapper)).not.toContain(LEAVE_THE_COURSE)
    },
  )

  it.each([
    ['accepted', 'danger'],
    ['declined', 'medium'],
  ] as const)('draws the action on a %s row in %s', async (status, colour) => {
    // Handing a place back cannot be undone from the app and tidying a
    // finished row can, and a swipe that paints both of them red teaches the
    // student to ignore the colour on the one that matters.
    seed.enrollments.push(anEnrollment({ status }))

    const wrapper = await openList()

    expect(rowsOn(wrapper)[0].findComponent(IonItemOption).props('color')).toBe(colour)
  })
})

/* -------------------------------------------------------------------------- */
/*                               Confirmations                                */
/* -------------------------------------------------------------------------- */

/**
 * The two actions that cannot be undone from here ask first; the one that can
 * does not.
 *
 * Only the school can give a place back, so handing one back is worth a
 * question. Putting a finished row away costs one tap to reverse, and a
 * question in front of it would be a dialogue about nothing, several times a
 * term.
 */
describe('asking before an action the app cannot reverse', () => {
  beforeEach(openDevice)

  it('asks before taking a request back, and writes nothing until it is answered', async () => {
    await placeOnDevice('pending')

    const wrapper = await openList()
    await swipe(wrapper, CANCEL_THE_REQUEST)

    expect(overlays.alerts).toHaveLength(1)
    expect(await statusOnDevice()).toBe('pending')
  })

  it('takes the request back once the question is answered', async () => {
    await placeOnDevice('pending')

    const wrapper = await openList()
    await swipe(wrapper, CANCEL_THE_REQUEST)
    await overlays.alerts[0].confirm()

    expect(await statusOnDevice()).toBe('withdrawn')
  })

  it('leaves the request alone when the question is declined', async () => {
    await placeOnDevice('pending')

    const wrapper = await openList()
    await swipe(wrapper, CANCEL_THE_REQUEST)
    await overlays.alerts[0].cancel()

    expect(await statusOnDevice()).toBe('pending')
  })

  it('asks before handing a place back', async () => {
    await placeOnDevice('accepted')

    const wrapper = await openList()
    await swipe(wrapper, LEAVE_THE_COURSE)

    expect(overlays.alerts).toHaveLength(1)
    expect(await statusOnDevice()).toBe('accepted')
  })

  it('does not ask before putting a finished request away', async () => {
    await placeOnDevice('declined')

    const wrapper = await openList()
    await swipe(wrapper, REMOVE_FROM_THE_LIST)

    expect(overlays.alerts).toHaveLength(0)
    expect((await onDevice())?.archivedByStudentAt).not.toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/*                          Removed, and the way back                         */
/* -------------------------------------------------------------------------- */

/**
 * The row is put away first and offered back second.
 *
 * The undo window is a toast, not a delay: the stamp is written and journaled
 * the moment the student swipes, so an application closed before the toast ran
 * out finds the row put away, exactly as it was left. Undo is the mirror
 * write — a second journaled row carrying the emptied stamp — and not a
 * cancellation of the first, because the first may already have gone.
 */
describe('putting a finished request away', () => {
  beforeEach(openDevice)
  beforeEach(() => placeOnDevice('declined'))

  const putAway = async (): Promise<VueWrapper> => {
    const wrapper = await openList()
    await swipe(wrapper, REMOVE_FROM_THE_LIST)

    return wrapper
  }

  it('offers the way back in a toast', async () => {
    await putAway()

    expect(overlays.toasts).toHaveLength(1)
    expect(overlays.toasts[0].message).toMatch(/removed/i)
    expect(overlays.toasts[0].actionLabel).toMatch(/undo/i)
  })

  it('writes the stamp before the toast is answered, not after', async () => {
    await putAway()

    expect((await onDevice())?.archivedByStudentAt).not.toBeNull()
  })

  it('journals the stamp straight away, so the window ends when the row leaves', async () => {
    await putAway()

    expect(await journaled()).toEqual([{ docId: ENROLLMENT_ID, archived: true }])
  })

  it('takes the row off the list without waiting for a sync run', async () => {
    const wrapper = await putAway()

    expect(rowsOn(wrapper)).toHaveLength(0)
  })

  it('brings the row back when undo is pressed inside the window', async () => {
    const wrapper = await putAway()
    await overlays.toasts[0].press()
    await settle()

    expect((await onDevice())?.archivedByStudentAt).toBeNull()
    expect(rowsOn(wrapper)).toHaveLength(1)
  })

  it('sends the undo after the removal rather than erasing it', async () => {
    await putAway()
    await overlays.toasts[0].press()

    expect(await journaled()).toEqual([
      { docId: ENROLLMENT_ID, archived: true },
      { docId: ENROLLMENT_ID, archived: false },
    ])
  })

  it('leaves the row away when the window closes with nobody pressing anything', async () => {
    const wrapper = await putAway()
    await overlays.toasts[0].expire()
    await settle()

    expect((await onDevice())?.archivedByStudentAt).not.toBeNull()
    expect(rowsOn(wrapper)).toHaveLength(0)
  })

  it('journals nothing more when the window closes unanswered', async () => {
    await putAway()
    await overlays.toasts[0].expire()

    expect(await journaled()).toEqual([{ docId: ENROLLMENT_ID, archived: true }])
  })
})

/* -------------------------------------------------------------------------- */
/*                            Two removals in a row                           */
/* -------------------------------------------------------------------------- */

/**
 * A second removal does not take the first one's way back with it.
 *
 * Two finished rows go away one after the other in about a second, and a toast
 * that replaced the one before it would close the first window before the
 * student ever had the chance to use it. So the toasts queue, and each one
 * remembers the row it belongs to: an undo acting on whichever row was newest
 * would bring back the wrong one.
 */
describe('two rows put away one after the other', () => {
  beforeEach(openDevice)

  beforeEach(async () => {
    await placeOnDevice('declined', { id: ENROLLMENT_ID, createdAt: LAST_YEAR })
    await placeOnDevice('revoked', { id: SECOND_ID, createdAt: THIS_YEAR })
  })

  const putBothAway = async (): Promise<void> => {
    const wrapper = await openList()
    await swipe(wrapper, REMOVE_FROM_THE_LIST, 0)
    await swipe(wrapper, REMOVE_FROM_THE_LIST, 0)
  }

  it('keeps the first window open instead of replacing it', async () => {
    await putBothAway()

    expect(overlays.toasts).toHaveLength(1)
  })

  it('offers the second way back once the first window has closed', async () => {
    await putBothAway()
    await overlays.toasts[0].expire()

    expect(overlays.toasts).toHaveLength(2)
  })

  it('undoes the row the first toast belongs to, not the row removed last', async () => {
    await putBothAway()
    await overlays.toasts[0].press()

    expect((await onDevice(ENROLLMENT_ID))?.archivedByStudentAt).toBeNull()
    expect((await onDevice(SECOND_ID))?.archivedByStudentAt).not.toBeNull()
  })
})

/* -------------------------------------------------------------------------- */
/*                            What the list leaves out                        */
/* -------------------------------------------------------------------------- */

/**
 * The list is the query's answer, and the query is where the rule lives.
 *
 * Which rows a student sees is decided in one place — the repository — and the
 * screen draws whatever comes back. A second copy of the rule inside the
 * component is a second rule, and the day the two disagree the row that
 * vanished is unreachable from anywhere.
 *
 * The rule reads no clock. A stamp dated next year hides the row exactly as one
 * dated last night: a phone whose clock is wrong would otherwise be a phone
 * whose list is wrong, with no screen to put it right from.
 */
describe('the list shows what the student has not put away', () => {
  const aPutAwayRow = (status: EnrollmentStatus, archivedAt: string) =>
    anEnrollment({
      id: SECOND_ID,
      status,
      archivedByStudentAt: parseIsoDateTime(archivedAt),
      createdAt: parseIsoDateTime(LAST_YEAR),
    })

  it('leaves out a finished request the student put away', async () => {
    seed.enrollments.push(anEnrollment({ status: 'pending' }))
    seed.enrollments.push(aPutAwayRow('declined', '2026-09-19T10:00:00.000Z'))

    const wrapper = await openList()

    expect(rowsOn(wrapper).map((row) => row.props('id'))).toEqual([ENROLLMENT_ID])
  })

  it('keeps a finished request the student has not put away', async () => {
    seed.enrollments.push(anEnrollment({ id: SECOND_ID, status: 'declined' }))

    const wrapper = await openList()

    expect(rowsOn(wrapper).map((row) => row.props('id'))).toEqual([SECOND_ID])
  })

  it('keeps a live row carrying a stamp it should never have carried', async () => {
    seed.enrollments.push(aPutAwayRow('accepted', '2026-09-19T10:00:00.000Z'))

    const wrapper = await openList()

    expect(rowsOn(wrapper)).toHaveLength(1)
  })

  it.each([
    ['dated long before the phone thinks now is', '2020-01-01T00:00:00.000Z'],
    ['dated well after it', '2099-01-01T00:00:00.000Z'],
  ])('hides a row whose stamp is %s, because no clock is read', async (_case, at) => {
    seed.enrollments.push(aPutAwayRow('revoked', at))

    const wrapper = await openList()

    expect(rowsOn(wrapper)).toHaveLength(0)
  })

  it('keeps a row the school put away in its own lists', async () => {
    // The school tidying up is its own business: the two stamps are separate
    // fields and neither is the other's. Nothing of the school's half reaches
    // the device at all, so the row arrives looking exactly like one nobody has
    // tidied — and the student is still offered their own way out of it.
    seed.enrollments.push(anEnrollment({ status: 'revoked' }))

    const wrapper = await openList()

    expect(rowsOn(wrapper)).toHaveLength(1)
    expect(actionsOn(wrapper)).toContain(REMOVE_FROM_THE_LIST)
  })
})

/* -------------------------------------------------------------------------- */
/*                             One row per attempt                            */
/* -------------------------------------------------------------------------- */

/**
 * Two attempts at one course are two rows, and they have to be tellable apart.
 *
 * A course can be applied for again once an earlier attempt has ended, so the
 * list legitimately carries last year's finished row beside this year's live
 * one. Two lines reading the same course name are a duplicate to look at
 * rather than a history, so each row carries the day it was asked for — and the
 * group, once the school has given one.
 */
describe('a row says which attempt it is', () => {
  it('names the group the student was placed in', async () => {
    seed.groups.push(aGroup())
    seed.enrollments.push(anEnrollment({ status: 'accepted', groupId: GROUP_ID }))

    const wrapper = await openList()

    expect(wrapper.text()).toContain('Tuesday evenings')
    expect(wrapper.text()).not.toContain('Waiting for a group')
  })

  it('keeps the placeholder while no group has been given', async () => {
    seed.enrollments.push(anEnrollment({ status: 'accepted', groupId: null }))

    const wrapper = await openList()

    expect(wrapper.text()).toContain('Waiting for a group')
  })

  it('dates each attempt, so an older one is not read as a duplicate', async () => {
    seed.enrollments.push(
      anEnrollment({ id: SECOND_ID, status: 'declined', createdAt: parseIsoDateTime(LAST_YEAR) }),
    )
    seed.enrollments.push(anEnrollment({ createdAt: parseIsoDateTime(THIS_YEAR) }))

    const wrapper = await openList()

    expect(rowsOn(wrapper)[0].text()).toContain('2025')
    expect(rowsOn(wrapper)[1].text()).toContain('2026')
  })
})

/* -------------------------------------------------------------------------- */
/*                           A round through the school                       */
/* -------------------------------------------------------------------------- */

/**
 * Leaving lasts, because it is a row and not a screen state.
 *
 * A local disappearance proves nothing. The question is what the student's
 * other phone shows once the school has heard about it, so these run the whole
 * circle — write, push, and pull onto a second device of the same student —
 * and then ask that device's list.
 */
describe('a request that has been round the school', () => {
  it('does not put a course the student left back on their other phone', async () => {
    const round = await aRoundTrip('accepted')

    const wrapper = await openList()

    // The row did reach the second phone — it is held and hidden, which is a
    // different fact from a pull that brought nothing.
    expect(round.landed).toBe('withdrawn')
    expect(rowsOn(wrapper)).toHaveLength(0)
  })

  it('carries a cancelled request to the school without it being refused', async () => {
    const round = await aRoundTrip('pending')

    expect(round.sent).toBe('withdrawn')
    expect(round.refused).toEqual([])
  })

  it('leaves a cancelled request off the other phone rather than leaving it hanging', async () => {
    const round = await aRoundTrip('pending')

    const wrapper = await openList()

    expect(round.landed).toBe('withdrawn')
    expect(rowsOn(wrapper)).toHaveLength(0)
  })
})

/* -------------------------------------------------------------------------- */
/*                                 The device                                 */
/* -------------------------------------------------------------------------- */

let enrollments: IEnrollmentRepository
let outbox: IOutboxRepository
let apply: ISyncApplyRepository

/** Swaps the reading double for the real store, so a write is a write. */
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

  enrollments = journaled.enrollments
  Object.assign(repositories, { enrollments })
}

const SERVER_HLC = '001789689200000:00000:server'

interface PlacedRow {
  id?: EnrollmentId
  createdAt?: string
}

/**
 * A row the school has already answered on, written the way a pull writes it.
 *
 * Deliberately not `request()`: a request of its own journals an outbox row,
 * and the claims below are about the rows the *screen* wrote.
 */
async function placeOnDevice(status: EnrollmentStatus, row: PlacedRow = {}): Promise<void> {
  const docId = row.id ?? ENROLLMENT_ID

  await apply.applyRemote(
    'enrollments',
    {
      docId,
      hlc: SERVER_HLC,
      deleted: false,
      data: {
        id: docId,
        schoolId: SCHOOL_ID,
        courseId: COURSE_ID,
        studentId: OWNER_ID,
        status,
        archivedByStudentAt: null,
        createdAt: row.createdAt ?? THIS_YEAR,
      },
    },
    SERVER_HLC,
    { kind: 'user', id: OWNER_ID },
  )
}

const onDevice = (id: EnrollmentId = ENROLLMENT_ID) => enrollments.getById(id)

const statusOnDevice = async (id: EnrollmentId = ENROLLMENT_ID) => (await onDevice(id))?.status

/** The journal as this band reads it: which row, and whether it carries a stamp. */
async function journaled(): Promise<{ docId: string; archived: boolean }[]> {
  const pending = await outbox.listPending({ ownerId: OWNER_ID })

  return pending
    .filter((row) => row.collection === 'enrollments')
    .map((row) => ({
      docId: row.docId,
      archived: (row.data?.archivedByStudentAt ?? null) !== null,
    }))
}

interface RoundTrip {
  /** What the school ended up holding, so an empty list is not read as a win. */
  sent: unknown

  /** What the student's other phone stored, by name rather than through the list. */
  landed: unknown

  /** The outbox rows the school refused: a cancellation turned down is none. */
  refused: readonly unknown[]
}

/** One phone leaves the course; the student's other phone pulls afterwards. */
async function aRoundTrip(status: EnrollmentStatus): Promise<RoundTrip> {
  const server = new FakeSyncServer()

  const one = await openHarness({ ownerId: OWNER_ID, deviceId: 'device-a', server })
  server.journal({
    collection: 'enrollments',
    docId: ENROLLMENT_ID,
    scope: USER_SCOPE,
    data: {
      id: ENROLLMENT_ID,
      schoolId: SCHOOL_ID,
      courseId: COURSE_ID,
      studentId: OWNER_ID,
      status,
      archivedByStudentAt: null,
      createdAt: THIS_YEAR,
    },
  })

  await one.engine.pull()
  await one.engine.enrollments.withdraw(ENROLLMENT_ID)
  await one.engine.push()

  const two = await openHarness({ ownerId: OWNER_ID, deviceId: 'device-b', server })
  await two.engine.pull()
  Object.assign(repositories, { enrollments: two.engine.enrollments })

  const held = await two.engine.enrollments.getById(ENROLLMENT_ID)
  const onServer = server.rows.filter((row) => row.collection === 'enrollments')

  return {
    sent: onServer[onServer.length - 1]?.data?.status,
    landed: held?.status,
    refused: (await one.outboxOf(OWNER_ID)).filter((row) => row.status === 'rejected'),
  }
}
