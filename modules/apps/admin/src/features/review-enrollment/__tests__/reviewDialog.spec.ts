import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages, translate } from '@/shared/i18n'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp, refusal } from '@/shared/testing'

import EnrollmentReviewDialog from '../ui/EnrollmentReviewDialog.vue'

const GROUPS = '/edu/groups'

// This suite's own copy, so the screen owns its wording and the test owns only
// the keys it reads a line by.
const copy = `
enrollments-review-title = The request
enrollments-review-decision = Group
enrollments-review-accept = Accept into the group
enrollments-review-times = When it suits
enrollments-review-zone = Hours in { $zone }
enrollments-review-groups-none = This course has no groups yet
enrollments-review-groups-unreadable = The list of groups did not load
enrollments-group-queue = In the queue
action-close = Close
action-cancel = Cancel
weekday-mon = Mon
weekday-sat = Sat
`

const ACROSS_MIDNIGHT = {
  timeZone: 'Europe/Belgrade',
  ranges: [{ days: ['mon'], startMinute: 1320, endMinute: 1560 }],
}

const TO_MIDNIGHT = {
  timeZone: 'Europe/Belgrade',
  ranges: [{ days: ['sat'], startMinute: 1080, endMinute: 1440 }],
}

const request = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  courseId: 'c1',
  studentId: 'u1',
  schoolId: 'school-1',
  status: 'pending',
  createdAt: '2026-09-01T10:00:00.000Z',
  ...over,
})

const open = async (answers: FakeAnswers, enrollment = request()) => {
  const transport = fakeHttpClient(answers)
  const page = mountWithApp(EnrollmentReviewDialog, {
    props: { open: true, enrollment },
    global: { provide: { [httpClientKey as symbol]: transport.client } },
  })

  await flushPromises()
  return page
}

const shown = () => document.body.textContent ?? ''

const acceptButton = () =>
  [...document.body.querySelectorAll('button')].find(
    (candidate) => candidate.textContent?.trim() === translate('enrollments-review-accept'),
  )

/**
 * What the moderator reads before deciding, read the way the student wrote it.
 *
 * A list that failed to arrive looks exactly like a course with no groups, and
 * an interval that runs past midnight is one interval, not a day that has
 * twenty-six hours.
 */
describe('the request under review', () => {
  beforeEach(() => {
    resetApi()
    document.body.innerHTML = ''
    addMessages({ en: copy, ru: copy })
  })

  it('tells a course with no groups apart from a list that did not arrive', async () => {
    await open({ [GROUPS]: { items: [] } })

    expect(shown()).toContain(translate('enrollments-review-groups-none'))
    expect(shown()).not.toContain(translate('enrollments-review-groups-unreadable'))
  })

  it('says the list did not arrive, and does not take a decision over it', async () => {
    await open({ [GROUPS]: refusal(500, 'boom') })

    expect(shown()).toContain(translate('enrollments-review-groups-unreadable'))
    expect(shown()).not.toContain(translate('enrollments-review-groups-none'))
    expect(acceptButton()).toBeUndefined()
  })

  it('still offers the decision when the list arrived', async () => {
    await open({ [GROUPS]: { items: [{ id: 'g1', name: 'Morning', status: 'pending' }] } })

    expect(acceptButton()).toBeDefined()
  })

  it('reads an interval that runs past midnight as the device reads it', async () => {
    await open({ [GROUPS]: { items: [] } }, request({ preferredTimes: ACROSS_MIDNIGHT }))

    expect(shown()).toContain('22:00 – 02:00')
  })

  it('reads the far side of midnight as the end of this day, not the start of the next', async () => {
    await open({ [GROUPS]: { items: [] } }, request({ preferredTimes: TO_MIDNIGHT }))

    expect(shown()).toContain('18:00 – 24:00')
  })
})
