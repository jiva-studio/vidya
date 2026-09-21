import { asId, type CourseId, type EnrollmentId, type SchoolId } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  aCourse,
  anEnrollment,
  aSchool,
  type DeviceRows,
  fakeDevice,
  mountAt,
  siteStandsAt,
} from '@/shared/data/__tests__/fakeDevice'
import { useSiteStatus } from '@/shared/status'

import LearningPage from '../ui/LearningPage.vue'

const render = async (rows: DeviceRows = {}) => {
  const device = fakeDevice(rows)
  const screen = await mountAt(LearningPage, '/', device.provide)

  await flushPromises()
  return { screen, device }
}

const bhakti = aSchool({ id: asId<SchoolId>('school-2'), name: 'Bhakti School', code: 'BHAKTI' })

describe('the learning screen', () => {
  beforeEach(() => {
    siteStandsAt()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('promises the courses are coming while the first run is still going', async () => {
    const { screen } = await render()

    expect(screen.text()).toContain('Your courses are on their way')
    expect(screen.text()).not.toContain('Nobody has invited you')
  })

  it('reads the schools again as synchronisation brings more', async () => {
    const { screen, device } = await render()

    useSiteStatus().runFinished(12, true)
    await flushPromises()

    expect(screen.text()).not.toContain('Your courses are on their way')
    expect(device.schools.list).toHaveBeenCalledTimes(2)
  })

  it('says nobody invited them once a finished run has found no school', async () => {
    siteStandsAt({ filled: true })

    const { screen } = await render()

    expect(screen.text()).toContain('Nobody has invited you anywhere')
    expect(screen.text()).toContain('Ask your school')
  })

  it('survives a database whose schema another tab has not created yet', async () => {
    const device = fakeDevice()
    vi.mocked(device.schools.list).mockRejectedValue(new Error('no such table: sync_rows'))

    const screen = await mountAt(LearningPage, '/', device.provide)
    await flushPromises()

    expect(screen.text()).toContain('My learning')
  })

  it('lists the courses of every school at once, each carrying its school', async () => {
    siteStandsAt({ filled: true })

    const { screen } = await render({
      schools: [aSchool(), bhakti],
      courses: [
        aCourse(),
        aCourse({
          id: asId<CourseId>('course-2'),
          schoolId: bhakti.id,
          name: 'Nectar of Devotion',
        }),
      ],
      enrollments: [
        anEnrollment(),
        anEnrollment({
          id: asId<EnrollmentId>('enrollment-2'),
          schoolId: bhakti.id,
          courseId: asId<CourseId>('course-2'),
        }),
      ],
    })

    expect(screen.text()).toContain('Bhagavad Gita')
    expect(screen.text()).toContain('Gita School')
    expect(screen.text()).toContain('Nectar of Devotion')
    expect(screen.text()).toContain('Bhakti School')
  })

  it('addresses a course by its school code and never by an identifier', async () => {
    siteStandsAt({ filled: true })

    const { screen } = await render({
      schools: [aSchool()],
      courses: [aCourse()],
      enrollments: [anEnrollment()],
    })

    const addresses = screen.findAll('a').map((link) => link.attributes('href'))

    expect(addresses).toContain('/s/GITA/c/course-1')
    expect(addresses).toContain('/s/GITA')
    expect(addresses.join(' ')).not.toContain('school-1')
  })

  it('says what became of a place rather than showing every one as studying', async () => {
    siteStandsAt({ filled: true })

    const { screen } = await render({
      schools: [aSchool()],
      courses: [aCourse()],
      enrollments: [anEnrollment({ status: 'pending' })],
    })

    expect(screen.text()).toContain('Waiting for an answer')
    expect(screen.text()).not.toContain('Studying')
  })

  it('names a school whose courses have not arrived rather than dropping the place', async () => {
    siteStandsAt({ filled: true })

    const { screen } = await render({
      schools: [aSchool()],
      courses: [],
      enrollments: [anEnrollment()],
    })

    expect(screen.text()).toContain('A course that has not arrived yet')
    expect(screen.text()).toContain('Gita School')
  })

  it('tells a member of a school with no place that they are on no course', async () => {
    siteStandsAt({ filled: true })

    const { screen } = await render({ schools: [aSchool()], courses: [aCourse()] })

    expect(screen.text()).toContain('You are not on a course yet')
    expect(screen.text()).not.toContain('Nobody has invited you')
  })
})
