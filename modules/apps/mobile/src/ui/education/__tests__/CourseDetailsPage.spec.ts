// @vitest-environment jsdom
import { parseIsoDateTime } from '@vidya/domain'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/app', async () => (await import('./localScreens')).appDouble)
vi.mock('@capacitor/network', async () => (await import('./localScreens')).capacitorNetworkDouble)

import CourseDetailsPage from '../pages/CourseDetailsPage.vue'
import {
  aCourse,
  anEnrollment,
  aSchool,
  COURSE_ID,
  ENROLLMENT_ID,
  mountPage,
  navigations,
  resetLocalScreens,
  seed,
  settle,
} from './localScreens'

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

  it.each(['pending', 'accepted', 'declined', 'revoked'] as const)(
    'offers to open the place instead when one is %s',
    async (status) => {
      seed.enrollments.push(anEnrollment({ status }))

      const wrapper = await openCourse()
      await settle()

      expect(wrapper.text()).toContain('Open my course')
      expect(wrapper.text()).not.toContain('Enroll')
    },
  )

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
