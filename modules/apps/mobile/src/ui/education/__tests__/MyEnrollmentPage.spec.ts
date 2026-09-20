// @vitest-environment jsdom
import { IonAlert } from '@ionic/vue'
import type { EnrollmentStatus, SyncRejectionReason } from '@vidya/domain'
import type { VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app', async () => (await import('./localScreens')).appDouble)
vi.mock('@capacitor/network', async () => (await import('./localScreens')).capacitorNetworkDouble)

import { RevokedEnrollmentNotice, SyncRejectionNotice } from '@/ui/sync'

import MyEnrollmentPage from '../pages/MyEnrollmentPage.vue'
import {
  aCourse,
  aGroup,
  aLesson,
  aLessonVersion,
  anEnrollment,
  aSchool,
  ENROLLMENT_ID,
  GROUP_ID,
  mountPage,
  outboxRows,
  repositories,
  resetLocalScreens,
  seed,
  settle,
} from './localScreens'
import { type StagedOverlays, stageOverlays } from './overlayDoubles'

const CANCEL_THE_REQUEST = 'Cancel the request'
const LEAVE_THE_COURSE = 'Leave the course'
const REMOVE_FROM_THE_LIST = 'Remove from the list'

let overlays: StagedOverlays

beforeEach(() => {
  resetLocalScreens()
  seed.schools.push(aSchool())
  seed.courses.push(aCourse())
  seed.lessons.push(aLesson())
  seed.versions.push(aLessonVersion())
  overlays = stageOverlays()
})

afterEach(async () => {
  await overlays.closeAll()
  vi.restoreAllMocks()
})

const openEnrollment = async (): Promise<VueWrapper> => {
  const wrapper = await mountPage(MyEnrollmentPage, { enrollmentId: ENROLLMENT_ID })
  await settle()

  return wrapper
}

/** The screen opened on a request that ended in `status`. */
async function openEnded(status: EnrollmentStatus): Promise<VueWrapper> {
  seed.enrollments.push(anEnrollment({ status }))

  return openEnrollment()
}

function buttonReading(wrapper: VueWrapper, label: string) {
  const button = wrapper.findAll('ion-button').find((candidate) => candidate.text().includes(label))
  if (button === undefined) throw new Error(`no button reading "${label}" on this screen`)

  return button
}

/** Whether the confirmation the danger action puts up is on screen. */
const confirming = (wrapper: VueWrapper) => wrapper.findComponent(IonAlert).props('isOpen') === true

async function confirm(wrapper: VueWrapper): Promise<void> {
  wrapper.findComponent(IonAlert).vm.$emit('didDismiss', { detail: { role: 'confirm' } })
  await settle()
}

/* -------------------------------------------------------------------------- */
/*                              Whose group it is                             */
/* -------------------------------------------------------------------------- */

/**
 * The group a student was placed in belongs on their own screen whatever the
 * group is doing.
 *
 * The catalogue hides a group that has stopped taking students, because
 * choosing it is no longer possible. That reasoning does not reach here: this
 * group is not a choice, it is where the student studies, and it turns from
 * recruiting to running on the very day the first lesson happens.
 */
describe('the group the student was placed in', () => {
  it('names the group once the school has given one', async () => {
    seed.groups.push(aGroup())
    seed.enrollments.push(anEnrollment({ status: 'accepted', groupId: GROUP_ID }))

    const wrapper = await openEnrollment()

    expect(wrapper.text()).toContain('Tuesday evenings')
  })

  it('names it even after that group stopped taking students', async () => {
    seed.groups.push(aGroup({ status: 'active' }))
    seed.enrollments.push(anEnrollment({ status: 'accepted', groupId: GROUP_ID }))

    const wrapper = await openEnrollment()

    expect(wrapper.text()).toContain('Tuesday evenings')
  })
})

/* -------------------------------------------------------------------------- */
/*                        Why the answer is taking so long                    */
/* -------------------------------------------------------------------------- */

/**
 * A group that closed while the request was waiting is an answer, not an error.
 *
 * The student asked for a group that no longer takes anybody, so the school
 * will put them somewhere else and that takes longer. Said out loud it is a
 * reason to keep waiting; left unsaid it is a request that has been ignored
 * for a fortnight.
 */
describe('a request still waiting for its answer', () => {
  const waitingFor = async (groupStatus: 'pending' | 'active'): Promise<VueWrapper> => {
    seed.groups.push(aGroup({ status: groupStatus }))
    seed.enrollments.push(anEnrollment({ status: 'pending', preferredGroupId: GROUP_ID }))

    return openEnrollment()
  }

  it('explains that the group the student asked for has closed', async () => {
    const wrapper = await waitingFor('active')

    expect(wrapper.text()).toMatch(/no longer taking students/i)
  })

  it('says nothing of the kind while that group is still taking students', async () => {
    const wrapper = await waitingFor('pending')

    expect(wrapper.text()).not.toMatch(/no longer taking students/i)
  })
})

/* -------------------------------------------------------------------------- */
/*                               How it ended                                 */
/* -------------------------------------------------------------------------- */

/**
 * A place taken away and a place handed back are not the same event.
 *
 * One notice draws both, because everything else about them is identical — the
 * heading, the promise about downloads, the way out of the list. The single
 * sentence that differs is the one that matters: telling a student the school
 * ended their enrolment when they ended it themselves is the screen blaming
 * somebody for what the student did.
 */
describe('a place the student no longer holds', () => {
  const noticeOn = async (status: EnrollmentStatus) =>
    (await openEnded(status)).findComponent(RevokedEnrollmentNotice)

  it('explains a place the school took back', async () => {
    const notice = await noticeOn('revoked')

    expect(notice.exists()).toBe(true)
    expect(notice.text()).toMatch(/the school ended/i)
  })

  it('explains a course the student walked away from without blaming the school', async () => {
    const notice = await noticeOn('withdrawn')

    expect(notice.exists()).toBe(true)
    expect(notice.text()).not.toMatch(/the school ended/i)
    expect(notice.text()).toMatch(/you left/i)
  })

  it('promises in both cases that the downloads stay', async () => {
    for (const status of ['revoked', 'withdrawn'] as const) {
      expect((await noticeOn(status)).text()).toMatch(/stays readable/i)
    }
  })

  it('offers the way out of the list beside the explanation', async () => {
    const wrapper = await openEnded('revoked')

    expect(buttonReading(wrapper, REMOVE_FROM_THE_LIST).exists()).toBe(true)
  })

  it('shows the undo toast when that way out is taken', async () => {
    repositories.enrollments.archive = vi.fn(async () => anEnrollment({ status: 'revoked' }))

    const wrapper = await openEnded('revoked')
    await buttonReading(wrapper, REMOVE_FROM_THE_LIST).trigger('click')
    await settle()

    expect(repositories.enrollments.archive).toHaveBeenCalledWith(ENROLLMENT_ID)
    expect(overlays.toasts[0]?.actionLabel).toMatch(/undo/i)
  })
})

/* -------------------------------------------------------------------------- */
/*                           Ending it from this screen                       */
/* -------------------------------------------------------------------------- */

/**
 * The screen offers the same three actions as the row it was opened from.
 *
 * A student who opened the request to read the refusal is in the place where
 * they decide what to do about it, and sending them back to the list to swipe
 * is asking them to remember where the action lives.
 */
describe('what the screen lets the student do about it', () => {
  it('offers to take back a request the school has not answered', async () => {
    const wrapper = await openEnded('pending')

    expect(buttonReading(wrapper, CANCEL_THE_REQUEST).exists()).toBe(true)
  })

  it('offers to hand back a place the student holds', async () => {
    const wrapper = await openEnded('accepted')

    expect(buttonReading(wrapper, LEAVE_THE_COURSE).exists()).toBe(true)
  })

  it('asks before taking a request back, and writes nothing until it is answered', async () => {
    repositories.enrollments.withdraw = vi.fn(async () => anEnrollment({ status: 'withdrawn' }))

    const wrapper = await openEnded('pending')
    await buttonReading(wrapper, CANCEL_THE_REQUEST).trigger('click')
    await settle()

    expect(confirming(wrapper)).toBe(true)
    expect(repositories.enrollments.withdraw).not.toHaveBeenCalled()
  })

  it('takes the request back once the question is answered', async () => {
    repositories.enrollments.withdraw = vi.fn(async () => anEnrollment({ status: 'withdrawn' }))

    const wrapper = await openEnded('pending')
    await buttonReading(wrapper, CANCEL_THE_REQUEST).trigger('click')
    await confirm(wrapper)

    expect(repositories.enrollments.withdraw).toHaveBeenCalledWith(ENROLLMENT_ID)
  })
})

/* -------------------------------------------------------------------------- */
/*                          The answer that never left                        */
/* -------------------------------------------------------------------------- */

/**
 * A cancellation the school would not take has to say which kind of refusal it
 * was, because the two ask the student for opposite things.
 *
 * A request that had already been answered and marked is settled: the school's
 * version is the true one, the copy on this phone is about to be replaced by
 * it, and there is nothing for the student to do. Every other refusal leaves
 * the student's own words on the device, still theirs, still sendable. One
 * sentence for both outcomes tells half of the students to wait for something
 * that will never happen and the other half that their work is gone.
 */
describe('a cancellation the school did not take', () => {
  const refusedWith = async (reason: SyncRejectionReason): Promise<VueWrapper> => {
    outboxRows.set(`enrollments:${ENROLLMENT_ID}`, { state: 'rejected', reason })

    return openEnded('accepted')
  }

  it('shows the refusal and its reason on the request itself', async () => {
    const wrapper = await refusedWith('alreadyAccepted')

    expect(wrapper.findComponent(SyncRejectionNotice).props('reason')).toBe('alreadyAccepted')
  })

  it('says nothing of the kind about a request that went through', async () => {
    outboxRows.set(`enrollments:${ENROLLMENT_ID}`, { state: 'accepted' })

    const wrapper = await openEnded('accepted')

    expect(wrapper.findComponent(SyncRejectionNotice).exists()).toBe(false)
  })

  it('asks the student to send a refusal they can still act on again', async () => {
    const wrapper = await refusedWith('malformed')

    expect(wrapper.text()).toMatch(/send it again/i)
  })

  it('tells a student whose request was already settled that there is nothing to resend', async () => {
    const wrapper = await refusedWith('alreadyAccepted')

    expect(wrapper.text()).not.toMatch(/send it again/i)
    expect(wrapper.text()).toMatch(/will not reach the school/i)
  })
})
