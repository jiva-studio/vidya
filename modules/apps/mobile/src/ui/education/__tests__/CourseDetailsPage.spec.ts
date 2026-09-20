// @vitest-environment jsdom
import { readFile } from 'node:fs/promises'

import type { EnrollmentStatus } from '@vidya/domain'
import { EnrollmentStatuses, parseIsoDateTime } from '@vidya/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app', async () => (await import('./localScreens')).appDouble)
vi.mock('@capacitor/network', async () => (await import('./localScreens')).capacitorNetworkDouble)

import CourseDetailsPage from '../pages/CourseDetailsPage.vue'
import {
  aCourse,
  aGroup,
  anEnrollment,
  aSchool,
  COURSE_ID,
  ENROLLMENT_ID,
  mountPage,
  navigations,
  OTHER_GROUP_ID,
  resetLocalScreens,
  seed,
  settle,
  THIRD_GROUP_ID,
} from './localScreens'

/**
 * Whether a place in that state is one the screen offers to open.
 *
 * Keyed by the domain's own list rather than spelled out beside the cases, so
 * a state added there has to be answered here instead of quietly sitting out
 * the run. Only a live place is one to open: a finished request is history, and
 * the course is open to be asked for again.
 */
const OPENS_THE_PLACE: Record<EnrollmentStatus, boolean> = {
  pending: true,
  accepted: true,
  declined: false,
  revoked: false,
  withdrawn: false,
}

const held = EnrollmentStatuses.filter((status) => OPENS_THE_PLACE[status])
const finished = EnrollmentStatuses.filter((status) => !OPENS_THE_PLACE[status])

const openCourse = () => mountPage(CourseDetailsPage, { id: COURSE_ID })

const pressTheButton = async () => {
  const wrapper = await openCourse()
  await settle()
  await wrapper.find('ion-button').trigger('click')
  await settle()

  return wrapper
}

beforeEach(() => {
  resetLocalScreens()
  seed.schools.push(aSchool())
  seed.courses.push(aCourse())
})

/**
 * A course offers one thing, and which one depends on whether a place is held.
 *
 * Offering to enrol somebody who is already enrolled is offering a second
 * request for a place that admits one, and the student who takes the offer ends
 * up looking at a `pending` row laid over the place they already have. The
 * screen reads the place beside the course so the question never arises.
 */
describe('a course knows whether the student already has a place', () => {
  it('offers to enrol when no place is held', async () => {
    const wrapper = await openCourse()
    await settle()

    expect(wrapper.text()).toContain('Enroll')
  })

  it.each(held)('offers to open the place instead when one is %s', async (status) => {
    seed.enrollments.push(anEnrollment({ status }))

    const wrapper = await openCourse()
    await settle()

    expect(wrapper.text()).toContain('Open my course')
    expect(wrapper.text()).not.toContain('Enroll')
  })

  it.each(finished)('offers to enrol again when the only place is %s', async (status) => {
    seed.enrollments.push(anEnrollment({ status }))

    const wrapper = await openCourse()
    await settle()

    expect(wrapper.text()).toContain('Enroll')
    expect(wrapper.text()).not.toContain('Open my course')
  })

  it('opens the place it found rather than the enrolment form', async () => {
    seed.enrollments.push(anEnrollment({ status: 'accepted' }))

    await pressTheButton()

    expect(navigations.at(-1)).toEqual({
      name: 'my-enrollment',
      params: { id: ENROLLMENT_ID },
    })
  })

  it('sends a student with no place to the enrolment form', async () => {
    await pressTheButton()

    expect(navigations.at(-1)).toEqual({ name: 'enroll', params: { id: COURSE_ID } })
  })

  it('offers to enrol again once the student has withdrawn their request', async () => {
    seed.enrollments.push(
      anEnrollment({ status: 'pending', deletedAt: parseIsoDateTime('2026-09-19T10:00:00.000Z') }),
    )

    const wrapper = await openCourse()
    await settle()

    expect(wrapper.text()).toContain('Enroll')
  })
})

/**
 * A course shows the groups it is taking students for, and nothing else.
 *
 * Which groups those are is the repository's answer, not the screen's: two
 * screens ask the same question, and a predicate written into both of them is
 * two predicates that will one day disagree.
 *
 * The card is a name and a description. A group still recruiting has no date to
 * start on — it is stamped when recruitment closes — so a card that prints one
 * either prints an empty line or a date that means the opposite of what a
 * student reads into it.
 */
describe('the groups a course is taking students for', () => {
  const aGroupCourse = () => seed.courses.splice(0, 1, aCourse({ learningType: 'group' }))

  it('names the ones still recruiting, with what they say about themselves', async () => {
    aGroupCourse()
    seed.groups.push(aGroup())

    const wrapper = await openCourse()
    await settle()

    expect(wrapper.text()).toContain('Tuesday evenings')
    expect(wrapper.text()).toContain('Two hours a week, online.')
  })

  it('leaves out the ones that have stopped taking students', async () => {
    aGroupCourse()
    seed.groups.push(
      aGroup({ id: OTHER_GROUP_ID, name: 'Closed Mondays', status: 'active' }),
      aGroup({ id: THIRD_GROUP_ID, name: 'Finished Fridays', status: 'inactive' }),
    )

    const wrapper = await openCourse()
    await settle()

    expect(wrapper.text()).not.toContain('Closed Mondays')
    expect(wrapper.text()).not.toContain('Finished Fridays')
  })

  it('prints no date on a group that has not started', async () => {
    aGroupCourse()
    seed.groups.push(aGroup({ startsAt: parseIsoDateTime('2026-10-01T09:00:00.000Z') }))

    const wrapper = await openCourse()
    await settle()

    expect(wrapper.text()).toContain('Tuesday evenings')
    expect(wrapper.text()).not.toMatch(/2026/)
  })

  it('says nothing about groups on a course taught one student at a time', async () => {
    seed.courses.splice(0, 1, aCourse({ learningType: 'individual' }))
    seed.groups.push(aGroup())

    const wrapper = await openCourse()
    await settle()

    expect(wrapper.text()).not.toContain('Tuesday evenings')
  })
})

/**
 * Neither screen spells out which groups are open.
 *
 * A status compared in a template is the filter living in a second place, and
 * the second place is the one nobody edits when the meaning of a status
 * changes — which it already has once.
 */
describe('the screens that read groups', () => {
  const SCREENS = ['../pages/CourseDetailsPage.vue', '../pages/EnrollPage.vue']

  it.each(SCREENS)('names no group status of its own in %s', async (screen) => {
    const source = await readFile(new URL(screen, import.meta.url), 'utf8')

    expect(source).not.toMatch(/'(pending|active|inactive)'/)
  })
})
