import type { IOutboxRepository, OutboxEntry } from '@vidya/domain'
import { asId, type LessonId, type SchoolId } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  aBlockState,
  aCourse,
  aLesson,
  anEnrollment,
  aSchool,
  aVersion,
  type DeviceRows,
  fakeDevice,
  mountAt,
  siteStandsAt,
  textOf,
} from '@/shared/data/__tests__/fakeDevice'
import { translate } from '@/shared/i18n'
import { useSiteStatus } from '@/shared/status'
import { useOutboxView } from '@/shared/sync'

import CoursePage from '../ui/CoursePage.vue'

const ADDRESS = '/s/GITA/c/course-1'

const taught: DeviceRows = {
  schools: [aSchool()],
  courses: [aCourse({ description: 'What this course is about' })],
  lessons: [
    aLesson({ id: asId<LessonId>('lesson-2'), lessonNumber: 2, title: 'The second lesson' }),
    aLesson(),
  ],
  versions: [aVersion()],
}

const render = async (rows: DeviceRows = taught, path = ADDRESS) => {
  const device = fakeDevice(rows)
  const screen = await mountAt(CoursePage, path, device.provide)

  await flushPromises()
  return { screen, device }
}

describe('one course', () => {
  beforeEach(() => {
    siteStandsAt({ filled: true })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('shows what the course teaches', async () => {
    const { screen } = await render()

    expect(screen.text()).toContain('Bhagavad Gita')
    expect(screen.text()).toContain('What this course is about')
  })

  it('lists the lessons in the order they are taught', async () => {
    const { screen } = await render()

    const titles = screen.findAll('li').map((row) => row.text())

    expect(titles[0]).toContain('The first lesson')
    expect(titles[1]).toContain('The second lesson')
  })

  it('shows what the student has already done, from the states on this device', async () => {
    const { screen } = await render({
      ...taught,
      enrollments: [anEnrollment()],
      blockStates: [aBlockState()],
    })

    expect(textOf(screen)).toContain('1 of 2 done')
  })

  it('says a lesson is not here rather than counting nothing out of nothing', async () => {
    const { screen } = await render({ ...taught, versions: [] })

    expect(screen.text()).toContain(translate('lesson-not-here'))
  })

  it('offers a place to a student who holds none', async () => {
    const { screen } = await render()

    expect(screen.text()).toContain('Ask for a place')
    expect(screen.find('a[href="/s/GITA/c/course-1/enroll"]').exists()).toBe(true)
  })

  it('says where the place stands instead of offering another one', async () => {
    const { screen } = await render({
      ...taught,
      enrollments: [anEnrollment({ status: 'pending' })],
    })

    expect(screen.text()).toContain('Waiting for an answer')
    expect(screen.text()).not.toContain('Ask for a place')
    expect(screen.find('a[href="/s/GITA/c/course-1/place"]').exists()).toBe(true)
  })

  it('says the course is not open to them rather than that it does not exist', async () => {
    const { screen } = await render({ schools: [aSchool()], courses: [] })

    expect(screen.text()).toContain(translate('course-absent-title'))
  })

  it('refuses a course of another school pasted under this code', async () => {
    const theirs = aCourse({ schoolId: asId<SchoolId>('school-2'), name: 'Somebody else course' })

    const { screen } = await render({ schools: [aSchool()], courses: [theirs] })

    expect(screen.text()).not.toContain('Somebody else course')
    expect(screen.text()).toContain(translate('course-absent-title'))
  })

  it('promises the course is coming while no run has finished here', async () => {
    siteStandsAt()

    const { screen } = await render({ schools: [aSchool()], courses: [] })

    expect(screen.text()).toContain('Your courses are on their way')
    expect(screen.text()).not.toContain(translate('course-absent-title'))
  })

  it('tells a course with no lessons apart from one whose lessons are coming', async () => {
    siteStandsAt()
    const arriving = await render({ ...taught, lessons: [] })

    expect(arriving.screen.text()).toContain('Your courses are on their way')

    siteStandsAt({ filled: true })
    const empty = await render({ ...taught, lessons: [] })

    expect(empty.screen.text()).toContain('no lessons yet')
  })

  it('addresses a lesson by the school code and the course, never by an identifier', async () => {
    const { screen } = await render()

    const addresses = screen.findAll('a').map((link) => link.attributes('href'))

    expect(addresses).toContain('/s/GITA/c/course-1/l/lesson-1')
    expect(addresses.join(' ')).not.toContain('school-1')
  })

  it('reads the course again as synchronisation brings more', async () => {
    const { device } = await render()

    useSiteStatus().runFinished(4, true)
    await flushPromises()

    expect(device.education.courses.getById).toHaveBeenCalledTimes(2)
  })
})

describe('the request for a place on this course', () => {
  const asked: DeviceRows = { ...taught, enrollments: [anEnrollment({ status: 'pending' })] }

  const journalOf = (rows: OutboxEntry[]): IOutboxRepository =>
    ({
      listUnsettled: vi.fn(async () => rows),
      listDead: vi.fn(async () => []),
    }) as unknown as IOutboxRepository

  const waiting = {
    id: 1,
    ownerId: 'student-1',
    collection: 'enrollments',
    docId: 'enrollment-1',
    op: 'put',
    status: 'rejected',
    reason: 'courseNotOffered',
  } as unknown as OutboxEntry

  beforeEach(() => {
    siteStandsAt({ filled: true })
    useOutboxView().forgetJournal()
  })

  it('says the school has the request once nothing is left in the journal', async () => {
    useOutboxView().adoptJournal('student-1', journalOf([]))
    const { screen } = await render(asked)

    expect(textOf(screen)).toContain(translate('sync-state-accepted'))
  })

  it('says why the school refused it, beside the request itself', async () => {
    useOutboxView().adoptJournal('student-1', journalOf([waiting]))
    await flushPromises()

    const { screen } = await render(asked)

    expect(textOf(screen)).toContain('Not accepted')
    expect(textOf(screen)).toContain('not taking students onto this course yet')
  })
})
