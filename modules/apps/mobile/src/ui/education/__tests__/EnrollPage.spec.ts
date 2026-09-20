// @vitest-environment jsdom
import { IonTextarea } from '@ionic/vue'
import type {
  EnrollmentId,
  EnrollmentStatus,
  IOutboxRepository,
  ISyncApplyRepository,
  TimeRange,
} from '@vidya/domain'
import { EnrollmentStatuses } from '@vidya/domain'
import type { VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app', async () => (await import('./localScreens')).appDouble)
vi.mock('@capacitor/network', async () => (await import('./localScreens')).capacitorNetworkDouble)

import { AsyncButton, TimePicker } from '@/design'
import { fixedClock, openTestDatabase } from '@/infra/persistence/testing'
import {
  createSqlBlockStateRepository,
  createSqlEnrollmentRepository,
  createSqlHomeworkRepository,
  createSqlOutboxRepository,
  createSqlSyncApplyRepository,
  withSyncJournaling,
} from '@/infra/repositories'

import { TimeRangeItem, TimeRangeSelector } from '../components/TimeRange'
import GroupSelector from '../containers/GroupSelector.vue'
import EnrollPage from '../pages/EnrollPage.vue'
import {
  aCourse,
  aGroup,
  aSchool,
  COURSE_ID,
  ENROLLMENT_ID,
  GROUP_ID,
  mintedIds,
  mountPage,
  navigations,
  OTHER_GROUP_ID,
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
  seed.courses.push(aCourse({ learningType: 'group' }))
  seed.groups.push(aGroup())
  await openDevice()
})

/** Replaces the seeded course with one taught one student at a time. */
function aCourseWithoutGroups(): void {
  seed.courses.splice(0, seed.courses.length, aCourse({ learningType: 'individual' }))
  seed.groups.length = 0
}

const openForm = async (): Promise<VueWrapper> => {
  const wrapper = await mountPage(EnrollPage, { courseId: COURSE_ID })
  await settle()

  return wrapper
}

/** Presses the button `taps` times before letting anything settle. */
async function tapEnrol(wrapper: VueWrapper, taps = 1): Promise<void> {
  const button = wrapper.findComponent(AsyncButton)
  for (let tap = 0; tap < taps; tap += 1) button.vm.$emit('click')

  await settle()
}

async function pressEnrol(taps = 1): Promise<void> {
  await tapEnrol(await openForm(), taps)
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

/* -------------------------------------------------------------------------- */
/*                              What is being asked                           */
/* -------------------------------------------------------------------------- */

const groupSection = (wrapper: VueWrapper) => wrapper.findComponent(GroupSelector)
const timeSection = (wrapper: VueWrapper) => wrapper.findComponent(TimeRangeSelector)
const commentField = (wrapper: VueWrapper) => wrapper.findComponent(IonTextarea)

const AN_EVENING: TimeRange = { days: ['mon', 'wed'], startMinute: 1080, endMinute: 1320 }

const chooseGroup = (wrapper: VueWrapper) =>
  groupSection(wrapper).vm.$emit('update:modelValue', GROUP_ID)

const offerTime = (wrapper: VueWrapper, ranges: readonly TimeRange[] = [AN_EVENING]) =>
  timeSection(wrapper).vm.$emit('update:modelValue', ranges)

const writeComment = (wrapper: VueWrapper) =>
  commentField(wrapper).vm.$emit('update:modelValue', 'Evenings suit me best')

const requested = () => repositories.enrollments.getLiveByCourse(COURSE_ID)

/**
 * A request carries three things, and the student fills in whichever of them
 * they have an answer to.
 *
 * They were a sequence once: pick a group, and the question about time either
 * followed or did not. Nothing about the request needs that. A student who
 * knows the group has nothing to say about time, and one who knows only their
 * evenings has no group to choose from yet — a form that hides the second
 * question behind the first answer loses whichever of the two they came to say.
 */
describe('the form a request is filled in on', () => {
  it('asks about the group, the time and the comment at once', async () => {
    const wrapper = await openForm()

    expect(groupSection(wrapper).exists()).toBe(true)
    expect(timeSection(wrapper).exists()).toBe(true)
    expect(commentField(wrapper).exists()).toBe(true)
  })

  it('keeps the time and the comment on screen once a group is chosen', async () => {
    const wrapper = await openForm()

    await chooseGroup(wrapper)
    await settle()

    expect(timeSection(wrapper).exists()).toBe(true)
    expect(commentField(wrapper).exists()).toBe(true)
  })

  it('keeps the group question on screen once a time is offered', async () => {
    const wrapper = await openForm()

    await offerTime(wrapper)
    await settle()

    expect(groupSection(wrapper).exists()).toBe(true)
  })

  it('leaves the groups out of a course taught one student at a time', async () => {
    aCourseWithoutGroups()

    const wrapper = await openForm()

    expect(groupSection(wrapper).exists()).toBe(false)
    expect(timeSection(wrapper).exists()).toBe(true)
    expect(commentField(wrapper).exists()).toBe(true)
  })

  it('offers only the groups still taking students', async () => {
    seed.groups.push(aGroup({ id: OTHER_GROUP_ID, name: 'Closed Mondays', status: 'active' }))

    const wrapper = await openForm()

    expect(wrapper.text()).toContain('Tuesday evenings')
    expect(wrapper.text()).not.toContain('Closed Mondays')
  })
})

/**
 * Each of the three stands on its own, so any one of them is a request.
 *
 * The button waits for none of them. Demanding a time from someone who has
 * already picked the group they want is refusing the request they came to make
 * over a question they have no answer to.
 */
describe('what the student asked for reaches the device', () => {
  it('carries the group when that is all there is', async () => {
    const wrapper = await openForm()

    await chooseGroup(wrapper)
    await tapEnrol(wrapper)

    expect(await requested()).toMatchObject({
      preferredGroupId: GROUP_ID,
      preferredTimes: null,
      comment: null,
    })
  })

  it('carries the time when no group was chosen', async () => {
    const wrapper = await openForm()

    await offerTime(wrapper)
    await tapEnrol(wrapper)

    expect(await requested()).toMatchObject({
      preferredGroupId: null,
      preferredTimes: { ranges: [AN_EVENING] },
      comment: null,
    })
  })

  it('carries the comment when it is the only thing said', async () => {
    const wrapper = await openForm()

    await writeComment(wrapper)
    await tapEnrol(wrapper)

    expect(await requested()).toMatchObject({
      preferredGroupId: null,
      preferredTimes: null,
      comment: 'Evenings suit me best',
    })
  })

  it('carries all three together', async () => {
    const wrapper = await openForm()

    await chooseGroup(wrapper)
    await offerTime(wrapper)
    await writeComment(wrapper)
    await tapEnrol(wrapper)

    expect(await requested()).toMatchObject({
      preferredGroupId: GROUP_ID,
      preferredTimes: { ranges: [AN_EVENING] },
      comment: 'Evenings suit me best',
    })
  })

  it('stamps the zone the student named those hours in', async () => {
    // Hours without a zone are a misunderstanding: the school reads them in its
    // own and puts the lesson at five in the morning. The zone is the phone's,
    // taken when the request is made.
    const phone = vi.spyOn(Intl, 'DateTimeFormat').mockReturnValue({
      resolvedOptions: () => ({ timeZone: 'Asia/Vladivostok' }),
    } as unknown as Intl.DateTimeFormat)

    try {
      const wrapper = await openForm()

      await offerTime(wrapper)
      await tapEnrol(wrapper)

      expect((await requested())?.preferredTimes?.timeZone).toBe('Asia/Vladivostok')
    } finally {
      phone.mockRestore()
    }
  })

  it('leaves the button pressable while no time has been given', async () => {
    const wrapper = await openForm()

    await chooseGroup(wrapper)
    await settle()

    expect(wrapper.findComponent(AsyncButton).props('disabled')).toBeFalsy()
  })

  it('journals what was asked for without sending a single request', async () => {
    const network = vi.spyOn(globalThis, 'fetch')
    const wrapper = await openForm()

    await chooseGroup(wrapper)
    await offerTime(wrapper)
    await tapEnrol(wrapper)

    const [row] = await journaled()
    expect(row?.data).toMatchObject({
      preferredGroupId: GROUP_ID,
      preferredTimes: { ranges: [AN_EVENING] },
    })
    expect(network).not.toHaveBeenCalled()
  })
})

/**
 * An interval already on the list is corrected where it stands.
 *
 * The picker opens on the hours the interval holds, and what comes back
 * replaces that one interval. Adding a second one instead leaves the student
 * deleting the mistake they were in the middle of fixing, and the days they
 * chose for it are not in the picker to be typed again.
 */
describe('correcting an interval already offered', () => {
  const openInterval = async (wrapper: VueWrapper) => {
    await offerTime(wrapper)
    await settle()
    await wrapper.findComponent(TimeRangeItem).trigger('click')
    await settle()

    return wrapper.findComponent(TimePicker)
  }

  it('opens the picker on the hours that interval holds', async () => {
    const wrapper = await openForm()

    const picker = await openInterval(wrapper)

    expect(picker.props('startMinute')).toBe(AN_EVENING.startMinute)
    expect(picker.props('endMinute')).toBe(AN_EVENING.endMinute)
  })

  it('rewrites that interval rather than adding a second one', async () => {
    const wrapper = await openForm()

    const picker = await openInterval(wrapper)
    picker.vm.$emit('confirm', { startMinute: 1140, endMinute: 1440 })
    await settle()

    await tapEnrol(wrapper)

    expect((await requested())?.preferredTimes?.ranges).toEqual([
      { days: AN_EVENING.days, startMinute: 1140, endMinute: 1440 },
    ])
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
    // Leaving ends a request without erasing it, and a request that has ended
    // holds no place — so the screen finds none and writes a new one beside it.
    const withdrawn = await placeOnTheDevice('pending')
    await repositories.enrollments.withdraw(withdrawn)

    await pressEnrol()

    const live = await liveEnrollments()
    expect(live).toHaveLength(1)
    expect(live[0]!.id).not.toBe(withdrawn)
    expect(live[0]!.id).toBe(mintedIds.at(-1))
    expect(live[0]!.status).toBe('pending')
  })

  it('keeps the request they left as the history of the course', async () => {
    const withdrawn = await placeOnTheDevice('pending')
    await repositories.enrollments.withdraw(withdrawn)

    await pressEnrol()

    expect(await repositories.enrollments.getById(withdrawn)).toMatchObject({
      id: withdrawn,
      status: 'withdrawn',
    })
  })
})
