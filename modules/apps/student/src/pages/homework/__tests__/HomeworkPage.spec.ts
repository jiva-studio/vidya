import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  aCourse,
  aLesson,
  anAnswer,
  anEnrollment,
  aSchool,
  aVersion,
  type DeviceRows,
  fakeDevice,
  mountAt,
  siteStandsAt,
  textOf,
} from '@/shared/data/__tests__/fakeDevice'
import { useOutboxView } from '@/shared/sync'

import HomeworkPage from '../ui/HomeworkPage.vue'

const learning: DeviceRows = {
  schools: [aSchool()],
  courses: [aCourse()],
  lessons: [aLesson()],
  versions: [aVersion()],
  enrollments: [anEnrollment()],
}

const render = async (rows: DeviceRows) => {
  const device = fakeDevice(rows)
  const screen = await mountAt(HomeworkPage, '/homework', device.provide)

  await flushPromises()
  return { screen, device }
}

beforeEach(() => {
  siteStandsAt({ filled: true })
  useOutboxView().forgetJournal()
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('my homework, across every school', () => {
  it('lists an answer under the lesson it was written on', async () => {
    const { screen } = await render({ ...learning, homework: [anAnswer()] })

    expect(textOf(screen)).toContain('The first lesson')
    expect(textOf(screen)).toContain('Bhagavad Gita')
  })

  it('links the answer to the lesson, under the school code the address is written with', async () => {
    const { screen } = await render({ ...learning, homework: [anAnswer()] })

    expect(screen.get('a').attributes('href')).toBe('/s/GITA/c/course-1/l/lesson-1')
  })

  it('says where each answer stands', async () => {
    const returned = anAnswer({ status: 'returned', grade: 40, comment: 'Try the second verse.' })
    const { screen } = await render({ ...learning, homework: [returned] })

    expect(textOf(screen)).toContain('Returned to you')
    expect(textOf(screen)).toContain('40')
    expect(textOf(screen)).toContain('Try the second verse.')
  })

  it('says there is nothing written yet rather than showing an empty list', async () => {
    const { screen } = await render(learning)

    expect(textOf(screen)).toContain('not written any homework yet')
  })

  it('promises the work is coming while no run has finished here', async () => {
    siteStandsAt()
    const { screen } = await render(learning)

    expect(textOf(screen)).toContain('on their way')
    expect(textOf(screen)).not.toContain('not written any homework yet')
  })
})
