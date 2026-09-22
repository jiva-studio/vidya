import { asId, type CourseId, type GroupId } from '@vidya/domain'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import {
  aCourse,
  aGroup,
  anEnrollment,
  aSchool,
  type DeviceRows,
  fakeDevice,
  letTheTabWrite,
  siteStandsAt,
} from '@/shared/data/__tests__/fakeDevice'

import { useEnrollForm } from '../model/useEnrollForm'

const start = (rows: DeviceRows = {}, writes = true) => {
  const device = fakeDevice(rows)
  letTheTabWrite(writes ? device.writes : undefined)
  let form!: ReturnType<typeof useEnrollForm>

  mount(
    defineComponent({
      setup() {
        form = useEnrollForm(
          () => 'GITA',
          () => 'course-1',
        )
        return () => null
      },
    }),
    { global: { provide: device.provide } },
  )

  return { form, device }
}

describe('useEnrollForm composable', () => {
  beforeEach(() => {
    siteStandsAt({ filled: true })
    letTheTabWrite(undefined)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('provides empty defaults when course does not exist', async () => {
    const { form } = start({ schools: [aSchool()] })
    await flushPromises()

    expect(form.course.value).toBeNull()
    expect(form.groups.value).toEqual([])
    expect(form.reading.value).toBe(false)
  })

  it('loads course and its recruiting groups when taught in groups', async () => {
    const group1 = aGroup({ id: asId<GroupId>('g1'), name: 'Group 1' })
    const { form } = start({
      schools: [aSchool()],
      courses: [aCourse({ id: asId<CourseId>('course-1'), learningType: 'group' })],
      groups: [group1],
    })
    await flushPromises()

    expect(form.course.value?.id).toBe('course-1')
    expect(form.groups.value).toHaveLength(1)
    expect(form.groups.value[0]?.name).toBe('Group 1')
  })

  it('refuses to ask when form is not writable or course is null', async () => {
    const { form } = start({ schools: [aSchool()] }, false)
    await flushPromises()

    const success = await form.ask({ preferredGroupId: null, times: [], comment: '' })
    expect(success).toBe(false)
    expect(form.busy.value).toBe(false)
    expect(form.failed.value).toBe(false)
  })

  it('handles write failure by logging and setting failed flag to true and busy to false', async () => {
    const { form, device } = start({
      schools: [aSchool()],
      courses: [aCourse({ id: asId<CourseId>('course-1') })],
    })
    await flushPromises()

    vi.mocked(device.writes.request).mockRejectedValueOnce(new Error('disk error'))
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const success = await form.ask({ preferredGroupId: null, times: [], comment: 'hello' })

    expect(success).toBe(false)
    expect(form.failed.value).toBe(true)
    expect(form.busy.value).toBe(false)
    expect(warnSpy).toHaveBeenCalledWith(
      'the request for a place could not be written',
      expect.any(Error),
    )
  })

  it('skips writing request if enrollment is already held', async () => {
    const { form, device } = start({
      schools: [aSchool()],
      courses: [aCourse({ id: asId<CourseId>('course-1') })],
      enrollments: [anEnrollment({ courseId: asId<CourseId>('course-1') })],
    })
    await flushPromises()

    const success = await form.ask({ preferredGroupId: null, times: [], comment: '' })
    expect(success).toBe(true)
    expect(device.writes.request).not.toHaveBeenCalled()
    expect(form.busy.value).toBe(false)
    expect(form.failed.value).toBe(false)
  })

  it('guards against concurrent/duplicate submissions when busy', async () => {
    const { form, device } = start({
      schools: [aSchool()],
      courses: [aCourse({ id: asId<CourseId>('course-1') })],
    })
    await flushPromises()

    let resolveRequest: () => void = () => {}
    vi.mocked(device.writes.request).mockReturnValueOnce(
      new Promise<void>((resolve) => {
        resolveRequest = resolve
      }) as never,
    )

    const first = form.ask({ preferredGroupId: null, times: [], comment: '' })
    expect(form.busy.value).toBe(true)

    // Second concurrent ask should be rejected immediately
    const second = await form.ask({ preferredGroupId: null, times: [], comment: '' })
    expect(second).toBe(false)

    resolveRequest()
    await first
    expect(form.busy.value).toBe(false)
  })
})
