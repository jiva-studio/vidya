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
import { translate } from '@/shared/i18n'
import { useSiteStatus } from '@/shared/status'

import LearningPage from '../ui/LearningPage.vue'

const render = async (rows: DeviceRows = {}) => {
  const device = fakeDevice(rows)
  const screen = await mountAt(LearningPage, '/learning', device.provide)

  await flushPromises()
  return { screen, device }
}

const bhakti = aSchool({ id: asId<SchoolId>('school-2'), name: 'Bhakti School', code: 'BHAKTI' })

describe('the courses a student holds a place on', () => {
  beforeEach(() => {
    siteStandsAt()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('promises the courses are coming while the first run is still going', async () => {
    const { screen } = await render()

    expect(screen.text()).toContain(translate('waiting-title'))
    expect(screen.text()).not.toContain(translate('learning-uninvited-title'))
  })

  it('reads the schools again as synchronisation brings more', async () => {
    const { screen, device } = await render()

    useSiteStatus().runFinished(12, true)
    await flushPromises()

    expect(screen.text()).not.toContain(translate('waiting-title'))
    expect(device.schools.list).toHaveBeenCalledTimes(2)
  })

  it('says nobody invited them once a finished run has found no school', async () => {
    siteStandsAt({ filled: true })

    const { screen } = await render()

    expect(screen.text()).toContain(translate('learning-uninvited-title'))
    expect(screen.text()).toContain(translate('learning-uninvited-text'))
  })

  it('survives a database whose schema another tab has not created yet', async () => {
    const device = fakeDevice()
    vi.mocked(device.schools.list).mockRejectedValue(new Error('no such table: sync_rows'))

    const screen = await mountAt(LearningPage, '/learning', device.provide)
    await flushPromises()

    expect(screen.text()).toContain(translate('learning-title'))
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

    expect(screen.text()).toContain(translate('place-pending'))
    expect(screen.text()).not.toContain(translate('place-accepted'))
  })

  it('names a school whose courses have not arrived rather than dropping the place', async () => {
    siteStandsAt({ filled: true })

    const { screen } = await render({
      schools: [aSchool()],
      courses: [],
      enrollments: [anEnrollment()],
    })

    expect(screen.text()).toContain(translate('learning-course-unnamed'))
    expect(screen.text()).toContain('Gita School')
  })

  it('tells a member of a school with no place that they are on no course', async () => {
    siteStandsAt({ filled: true })

    const { screen } = await render({ schools: [aSchool()], courses: [aCourse()] })

    expect(screen.text()).toContain(translate('learning-no-courses-title'))
    expect(screen.text()).not.toContain(translate('learning-uninvited-title'))
  })

  it('offers the way to the courses on offer rather than a dead end', async () => {
    siteStandsAt({ filled: true })

    const { screen } = await render({ schools: [aSchool()], courses: [aCourse()] })

    const out = screen.findAll('a').find((link) => link.text() === translate('learning-browse'))

    expect(out?.attributes('href')).toBe('/')
  })
})
