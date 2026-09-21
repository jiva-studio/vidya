import { education } from '@vidya/client'
import { asId, type GroupId } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  aCourse,
  addressOf,
  aGroup,
  anEnrollment,
  aSchool,
  type DeviceRows,
  fakeDevice,
  letTheTabWrite,
  mountAt,
  siteStandsAt,
} from '@/shared/data/__tests__/fakeDevice'

import EnrollPage from '../ui/EnrollPage.vue'

const ADDRESS = '/s/GITA/c/course-1/enroll'

const taught: DeviceRows = {
  schools: [aSchool()],
  courses: [aCourse({ learningType: 'group' })],
  groups: [aGroup(), aGroup({ id: asId<GroupId>('group-2'), name: 'Sunday mornings' })],
}

const render = async (rows: DeviceRows = taught, writes = true) => {
  const device = fakeDevice(rows)
  letTheTabWrite(writes ? device.writes : undefined)

  const screen = await mountAt(EnrollPage, ADDRESS, device.provide)
  await flushPromises()

  return { screen, device }
}

const submit = async (screen: Awaited<ReturnType<typeof render>>['screen']) => {
  await screen.find('[data-test="ask"]').trigger('click')
  await flushPromises()
}

describe('asking for a place', () => {
  beforeEach(() => {
    siteStandsAt({ filled: true })
    letTheTabWrite(undefined)
    education.useUuidSource(() => 'enrollment-written')
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('offers the groups of the course that are still taking students', async () => {
    const closed = aGroup({ id: asId<GroupId>('group-3'), name: 'Last year', status: 'inactive' })

    const { screen } = await render({ ...taught, groups: [...taught.groups!, closed] })

    expect(screen.text()).toContain('Tuesday evenings')
    expect(screen.text()).toContain('Sunday mornings')
    expect(screen.text()).not.toContain('Last year')
  })

  it('asks for no group at all when the course is not taught in groups', async () => {
    const { screen } = await render({ ...taught, courses: [aCourse()] })

    expect(screen.text()).not.toContain('Tuesday evenings')
  })

  it('writes the request on this device, with nothing sent', async () => {
    const { screen, device } = await render()

    await submit(screen)

    expect(device.writes.request).toHaveBeenCalledTimes(1)
    expect(device.writes.request).toHaveBeenCalledWith(
      expect.objectContaining({ courseId: 'course-1', schoolId: 'school-1' }),
    )
  })

  it('carries no group at all while the student has named none', async () => {
    const { screen, device } = await render()

    await submit(screen)

    expect(device.writes.request).toHaveBeenCalledWith(
      expect.not.objectContaining({ preferredGroupId: expect.anything() }),
    )
  })

  it('carries the group the student would like', async () => {
    const { screen, device } = await render()

    await screen.findAll('[role="radio"]')[1]!.trigger('click')
    await submit(screen)

    expect(device.writes.request).toHaveBeenCalledWith(
      expect.objectContaining({ preferredGroupId: 'group-1' }),
    )
  })

  it('carries the hours the student offers, in the zone they named them in', async () => {
    const { screen, device } = await render()

    await screen.findAll('[role="checkbox"]')[0]!.trigger('click')
    await submit(screen)

    const written = vi.mocked(device.writes.request).mock.calls[0]![0]

    expect(written.preferredTimes?.ranges).toEqual([education.TIME_RANGE_PRESETS[0]!.range])
    expect(written.preferredTimes?.timeZone).toBeTruthy()
  })

  it('carries nothing for a comment of spaces', async () => {
    const { screen, device } = await render()

    await screen.find('textarea').setValue('  ')
    await submit(screen)

    expect(vi.mocked(device.writes.request).mock.calls[0]![0].comment).toBeUndefined()
  })

  it('carries what the student wrote to the school', async () => {
    const { screen, device } = await render()

    await screen.find('textarea').setValue('I can only study after work')
    await submit(screen)

    expect(vi.mocked(device.writes.request).mock.calls[0]![0].comment).toBe(
      'I can only study after work',
    )
  })

  it('shows the request once it is written, rather than the form again', async () => {
    const { screen } = await render()

    await submit(screen)

    expect(addressOf(screen)).toBe('place')
  })

  it('asks once, however many times the button is pressed', async () => {
    const { screen, device } = await render()

    await screen.find('[data-test="ask"]').trigger('click')
    await screen.find('[data-test="ask"]').trigger('click')
    await flushPromises()

    expect(device.writes.request).toHaveBeenCalledTimes(1)
  })

  it('sends a student who already holds a place to it instead of offering a second', async () => {
    const { screen, device } = await render({ ...taught, enrollments: [anEnrollment()] })

    await submit(screen)

    expect(device.writes.request).not.toHaveBeenCalled()
    expect(addressOf(screen)).toBe('place')
  })

  it('says a course that is not on this device cannot be asked for', async () => {
    const { screen } = await render({ schools: [aSchool()], courses: [] })

    expect(screen.text()).toContain('not on this device')
    expect(screen.find('[data-test="ask"]').exists()).toBe(false)
  })

  it('refuses to write from a tab that is not the one keeping the data', async () => {
    const { screen } = await render(taught, false)

    expect(screen.find('[data-test="ask"]').attributes('disabled')).toBeDefined()
    expect(screen.text()).toContain('Another tab')
  })

  it('says the request could not be written rather than pretending it was', async () => {
    const { screen, device } = await render()
    vi.mocked(device.writes.request).mockRejectedValueOnce(new Error('no room'))

    await submit(screen)

    expect(screen.text()).toContain('could not be saved')
    expect(addressOf(screen)).toBe('enroll')
  })
})
