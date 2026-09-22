import type { HttpClient } from '@vidya/client'
import { asId, type CourseId, type EnrollmentId, type SchoolId } from '@vidya/domain'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { messages } from '@/features/leave-school'
import { httpClientKey } from '@/shared/api'
import {
  aCourse,
  anEnrollment,
  aSchool,
  type DeviceRows,
  fakeDevice,
} from '@/shared/data/__tests__/fakeDevice'
import { translate } from '@/shared/i18n'
import { addMessages, fluent } from '@/shared/i18n'

import { toSchoolRows } from '../model'
import MySchools from '../ui/MySchools.vue'

const another = aSchool({ id: asId<SchoolId>('school-2'), name: 'Bhakti School', code: 'BHAKTI' })

const render = async (rows: DeviceRows) => {
  const device = fakeDevice(rows)

  const screen = mount(MySchools, {
    global: {
      plugins: [fluent],
      provide: {
        ...device.provide,
        [httpClientKey as symbol]: { delete: vi.fn() } as unknown as HttpClient,
      },
    },
  })

  await flushPromises()

  return { screen, device }
}

describe('the schools a student belongs to', () => {
  beforeEach(() => {
    addMessages(messages)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('lists them from this device, and not from a question asked of the server', async () => {
    const { screen, device } = await render({ schools: [aSchool(), another] })

    expect(screen.text()).toContain('Gita School')
    expect(screen.text()).toContain('Bhakti School')
    expect(device.schools.list).toHaveBeenCalled()
  })

  it('offers the way out of each of them', async () => {
    const { screen } = await render({ schools: [aSchool(), another] })

    expect(screen.findAll('button')).toHaveLength(2)
  })

  it('says so plainly while the student is in no school at all', async () => {
    const { screen } = await render({ schools: [] })

    expect(screen.text()).toContain(translate('settings-schools-none'))
  })
})

describe('what leaving a school would cost', () => {
  it('counts the places that school would revoke, and no others', () => {
    const mine = anEnrollment({ status: 'accepted' })
    const waiting = anEnrollment({
      id: asId<EnrollmentId>('enrollment-2'),
      courseId: asId<CourseId>('course-2'),
      status: 'pending',
    })
    const elsewhere = anEnrollment({
      id: asId<EnrollmentId>('enrollment-3'),
      schoolId: asId<SchoolId>('school-2'),
    })

    const rows = toSchoolRows([aSchool(), another], [mine, waiting, elsewhere])

    expect(rows[0]!.places).toBe(2)
    expect(rows[1]!.places).toBe(1)
  })

  it('counts a request that has ended as no place, because it holds none', () => {
    const gone = anEnrollment({ status: 'withdrawn' })
    const refused = anEnrollment({ id: asId<EnrollmentId>('enrollment-2'), status: 'declined' })

    const rows = toSchoolRows([aSchool()], [gone, refused])

    expect(rows[0]!.places).toBe(0)
  })

  it('lists a school the student holds no place in at all', () => {
    expect(toSchoolRows([aSchool()], [])).toHaveLength(1)
  })
})

describe('a settings screen with a course on it', () => {
  it('does not read the catalogue to count places', async () => {
    const { device } = await render({ schools: [aSchool()], courses: [aCourse()] })

    expect(device.education.courses.list).not.toHaveBeenCalled()
  })
})
