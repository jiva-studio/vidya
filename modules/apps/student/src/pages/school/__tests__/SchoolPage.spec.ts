import { asId, type CourseId, type SchoolId } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  aCourse,
  aSchool,
  type DeviceRows,
  fakeDevice,
  mountAt,
  siteStandsAt,
} from '@/shared/data/__tests__/fakeDevice'
import { useSiteStatus } from '@/shared/status'

import SchoolPage from '../ui/SchoolPage.vue'

const render = async (rows: DeviceRows = {}, path = '/s/GITA') => {
  const device = fakeDevice(rows)
  const screen = await mountAt(SchoolPage, path, device.provide)

  await flushPromises()
  return { screen, device }
}

describe("a school's catalogue", () => {
  beforeEach(() => {
    siteStandsAt({ filled: true })
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('finds the school by the code the address carries', async () => {
    const { screen, device } = await render({ schools: [aSchool()], courses: [aCourse()] })

    expect(device.schools.getByCode).toHaveBeenCalledWith('GITA')
    expect(screen.text()).toContain('Gita School')
  })

  it('shows the courses the school publishes', async () => {
    const { screen } = await render({ schools: [aSchool()], courses: [aCourse()] })

    expect(screen.text()).toContain('Bhagavad Gita')
  })

  it('keeps a draft out of the catalogue although the device holds it', async () => {
    const { screen } = await render({
      schools: [aSchool()],
      courses: [aCourse({ status: 'draft', name: 'Unfinished course' })],
    })

    expect(screen.text()).not.toContain('Unfinished course')
    expect(screen.text()).toContain('shows no courses')
  })

  it('shows no course of another school under this code', async () => {
    const theirs = aCourse({
      id: asId<CourseId>('course-2'),
      schoolId: asId<SchoolId>('school-2'),
      name: 'Somebody else course',
    })

    const { screen } = await render({ schools: [aSchool()], courses: [theirs] })

    expect(screen.text()).not.toContain('Somebody else course')
  })

  it('says the school is not on this device rather than that it does not exist', async () => {
    const { screen } = await render({ schools: [] })

    expect(screen.text()).toContain('not on this device')
  })

  it('promises the school is coming while no run has finished here', async () => {
    siteStandsAt()

    const { screen } = await render({ schools: [] })

    expect(screen.text()).toContain('Your courses are on their way')
    expect(screen.text()).not.toContain('not on this device')
  })

  it('tells an empty school apart from one whose courses have not arrived', async () => {
    siteStandsAt()
    const arriving = await render({ schools: [aSchool()], courses: [] })

    expect(arriving.screen.text()).toContain('Your courses are on their way')

    siteStandsAt({ filled: true })
    const empty = await render({ schools: [aSchool()], courses: [] })

    expect(empty.screen.text()).toContain('shows no courses')
  })

  it('addresses a course by the code, never by an identifier', async () => {
    const { screen } = await render({ schools: [aSchool()], courses: [aCourse()] })

    const addresses = screen.findAll('a').map((link) => link.attributes('href'))

    expect(addresses).toEqual(['/s/GITA/c/course-1'])
  })

  it('reads the catalogue again as synchronisation brings more', async () => {
    const { device } = await render({ schools: [aSchool()], courses: [aCourse()] })

    useSiteStatus().runFinished(5, true)
    await flushPromises()

    expect(device.schools.getByCode).toHaveBeenCalledTimes(2)
  })
})
