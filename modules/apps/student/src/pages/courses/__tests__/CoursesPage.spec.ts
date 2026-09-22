import { asId, type CourseId, type SchoolId } from '@vidya/domain'
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

import CoursesPage from '../ui/CoursesPage.vue'

const render = async (rows: DeviceRows = {}) => {
  const device = fakeDevice(rows)
  const screen = await mountAt(CoursesPage, '/', device.provide)

  await flushPromises()
  return { screen, device }
}

const bhakti = aSchool({ id: asId<SchoolId>('school-2'), name: 'Bhakti School', code: 'BHAKTI' })

const manyCourses = (count: number) =>
  Array.from({ length: count }, (_, at) =>
    aCourse({ id: asId<CourseId>(`course-${at}`), name: `Course number ${at}` }),
  )

describe('the front page of the site', () => {
  beforeEach(() => {
    siteStandsAt({ filled: true })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('lists the courses of every school the student belongs to in one list', async () => {
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
    })

    expect(screen.text()).toContain('Bhagavad Gita')
    expect(screen.text()).toContain('Nectar of Devotion')
  })

  it('labels each course with the school that teaches it', async () => {
    const { screen } = await render({ schools: [aSchool()], courses: [aCourse()] })

    expect(screen.text()).toContain('Gita School')
  })

  it('keeps a course the school has not published out of the list', async () => {
    const { screen } = await render({
      schools: [aSchool()],
      courses: [aCourse({ status: 'draft', name: 'Unfinished course' })],
    })

    expect(screen.text()).not.toContain('Unfinished course')
    expect(screen.text()).toContain(translate('courses-none-title'))
  })

  it('offers to ask for a place on a course the student is not on', async () => {
    const { screen } = await render({ schools: [aSchool()], courses: [aCourse()] })

    const asking = screen.findAll('a').find((link) => link.text() === translate('courses-ask'))

    expect(asking?.attributes('href')).toBe('/s/GITA/c/course-1/enroll')
  })

  it('says where a request stands instead of offering to ask for a place again', async () => {
    const { screen } = await render({
      schools: [aSchool()],
      courses: [aCourse()],
      enrollments: [anEnrollment({ status: 'pending' })],
    })

    expect(screen.text()).toContain(translate('place-pending'))
    expect(screen.text()).not.toContain(translate('courses-ask'))
  })

  it('leads from a course to the course itself, addressed by the school code', async () => {
    const { screen } = await render({ schools: [aSchool()], courses: [aCourse()] })

    const addresses = screen.findAll('a').map((link) => link.attributes('href'))

    expect(addresses).toContain('/s/GITA/c/course-1')
    expect(addresses).toContain('/s/GITA')
    expect(addresses.join(' ')).not.toContain('school-1')
  })

  it('offers no search field while the whole list fits the eye', async () => {
    const { screen } = await render({ schools: [aSchool()], courses: manyCourses(3) })

    expect(screen.find('input').exists()).toBe(false)
  })

  it('offers a search field once the list is long', async () => {
    const { screen } = await render({ schools: [aSchool()], courses: manyCourses(12) })

    expect(screen.find('input').exists()).toBe(true)
  })

  it('shows only the courses whose name carries what was typed', async () => {
    const { screen } = await render({ schools: [aSchool()], courses: manyCourses(12) })

    await screen.find('input').setValue('number 7')

    expect(screen.text()).toContain('Course number 7')
    expect(screen.text()).not.toContain('Course number 8')
  })

  it('keeps the search field while a query has left nothing to show', async () => {
    const { screen } = await render({ schools: [aSchool()], courses: manyCourses(12) })

    await screen.find('input').setValue('nothing of the sort')

    expect(screen.find('input').exists()).toBe(true)
  })

  it('tells a student who is in no school how to get into one', async () => {
    const { screen } = await render()

    expect(screen.text()).toContain(translate('courses-uninvited-title'))
    expect(screen.text()).toContain(translate('courses-uninvited-text'))
  })

  it('asks a student who has just joined to wait rather than turning them away', async () => {
    siteStandsAt({ filled: false, joined: true })

    const { screen } = await render()

    expect(screen.text()).toContain(translate('waiting-title'))
    expect(screen.text()).not.toContain(translate('courses-uninvited-title'))
  })

  it('reads the courses again as more arrive', async () => {
    const { device } = await render({ schools: [aSchool()], courses: [aCourse()] })

    useSiteStatus().runFinished(4, true)
    await flushPromises()

    expect(device.education.courses.list).toHaveBeenCalledTimes(2)
  })
})
