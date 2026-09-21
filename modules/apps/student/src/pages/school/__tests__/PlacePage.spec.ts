import type { IOutboxRepository, OutboxEntry } from '@vidya/domain'
import { asId, type GroupId, toIsoDateTime } from '@vidya/domain'
import { AlertDialog } from '@vidya/ui'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  aCourse,
  aGroup,
  anEnrollment,
  aSchool,
  type DeviceRows,
  fakeDevice,
  letTheTabWrite,
  mountAt,
  siteStandsAt,
  textOf,
} from '@/shared/data/__tests__/fakeDevice'
import { translate } from '@/shared/i18n'
import { useOutboxView } from '@/shared/sync'

import PlacePage from '../ui/PlacePage.vue'

const ADDRESS = '/s/GITA/c/course-1/place'

const held: DeviceRows = {
  schools: [aSchool()],
  courses: [aCourse()],
  enrollments: [anEnrollment({ status: 'pending' })],
}

const render = async (rows: DeviceRows = held, writes = true) => {
  const device = fakeDevice(rows)
  letTheTabWrite(writes ? device.writes : undefined)

  const screen = await mountAt(PlacePage, ADDRESS, device.provide)
  await flushPromises()

  return { screen, device }
}

const aRow = (overrides: Partial<OutboxEntry> = {}): OutboxEntry => ({
  id: 1,
  collection: 'enrollments',
  docId: 'enrollment-1',
  op: 'upsert',
  data: null,
  hlc: '1',
  baseHlc: null,
  ownerId: 'student-1',
  status: 'pending',
  reason: null,
  createdAt: toIsoDateTime(new Date('2026-01-01T00:00:00.000Z')),
  ...overrides,
})

const journalHolds = async (rows: OutboxEntry[]): Promise<void> => {
  const unsettled = rows.filter((row) => row.status !== 'rejected')
  const dead = rows.filter((row) => row.status === 'rejected')

  useOutboxView().adoptJournal('student-1', {
    listUnsettled: async () => unsettled,
    listDead: async () => dead,
  } as unknown as IOutboxRepository)

  await flushPromises()
}

type Screen = Awaited<ReturnType<typeof render>>['screen']

const act = async (screen: Screen) => {
  await screen.findAll('button').at(-1)!.trigger('click')
  await flushPromises()
}

/** The question asked before what cannot be undone, as the dialog carries it. */
const asked = (screen: Screen) => screen.findComponent(AlertDialog)

const sayYes = async (screen: Screen) => {
  asked(screen).vm.$emit('confirm')
  await flushPromises()
}

describe('what became of a request', () => {
  beforeEach(() => {
    siteStandsAt({ filled: true })
    letTheTabWrite(undefined)
    useOutboxView().forgetJournal()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('says where the request stands and which course it is for', async () => {
    const { screen } = await render()

    expect(screen.text()).toContain('Waiting for an answer')
    expect(screen.text()).toContain('Bhagavad Gita')
  })

  it('names the group the school put the student in', async () => {
    const { screen } = await render({
      ...held,
      groups: [aGroup()],
      enrollments: [anEnrollment({ status: 'accepted', groupId: 'group-1' })],
    })

    expect(screen.text()).toContain('Tuesday evenings')
  })

  it('names the group the student asked for as the wish it is', async () => {
    const { screen } = await render({
      ...held,
      groups: [aGroup({ id: asId<GroupId>('group-2'), name: 'Sunday mornings' })],
      enrollments: [
        anEnrollment({ status: 'pending', preferredGroupId: asId<GroupId>('group-2') }),
      ],
    })

    expect(screen.text()).toContain('The group you asked for')
    expect(screen.text()).toContain('Sunday mornings')
  })

  it('reads back the hours the student offered', async () => {
    const { screen } = await render({
      ...held,
      enrollments: [
        anEnrollment({
          status: 'pending',
          preferredTimes: {
            timeZone: 'Europe/Belgrade',
            ranges: [{ days: ['sat', 'sun'], startMinute: 540, endMinute: 660 }],
          },
        }),
      ],
    })

    expect(textOf(screen)).toContain('09:00–11:00')
  })

  it('says a request nothing has answered for yet is saved here and not sent', async () => {
    const { screen } = await render()
    await journalHolds([aRow()])

    expect(screen.text()).toContain(translate('submission-notSent'))
  })

  it('says the school has it once the journal holds nothing about it', async () => {
    const { screen } = await render()
    await journalHolds([])

    expect(screen.text()).toContain('The school has it')
  })

  it('names the refusal rather than showing something went wrong', async () => {
    const { screen } = await render()
    await journalHolds([aRow({ status: 'rejected', reason: 'courseNotOffered' })])

    expect(screen.text()).toContain('not taking students onto this course yet')
    expect(screen.text()).toContain(translate('place-rejected-kept'))
  })

  it('asks before handing a waiting request back', async () => {
    const { screen, device } = await render()

    await act(screen)

    expect(device.writes.withdraw).not.toHaveBeenCalled()
    expect(asked(screen).props('open')).toBe(true)
    expect(asked(screen).props('description')).toContain('You can ask again later')
  })

  it('hands the request back once the student has said yes', async () => {
    const { screen, device } = await render()

    await act(screen)
    await sayYes(screen)

    expect(device.writes.withdraw).toHaveBeenCalledWith('enrollment-1')
    expect(screen.text()).toContain('You left this course')
  })

  it('warns that leaving a course is not cancelling a request', async () => {
    const { screen } = await render({
      ...held,
      enrollments: [anEnrollment({ status: 'accepted' })],
    })

    await act(screen)

    expect(asked(screen).props('description')).toContain('lose your place')
  })

  it('puts a finished request away without asking, because bringing it back is one click', async () => {
    const { screen, device } = await render({
      ...held,
      enrollments: [anEnrollment({ status: 'declined' })],
    })

    await act(screen)

    expect(device.writes.archive).toHaveBeenCalledWith('enrollment-1')
    expect(screen.text()).toContain('put away')
  })

  it('brings a request that was put away back', async () => {
    const { screen, device } = await render({
      ...held,
      enrollments: [anEnrollment({ status: 'declined' })],
    })

    await act(screen)
    await act(screen)

    expect(device.writes.unarchive).toHaveBeenCalledWith('enrollment-1')
  })

  it('keeps showing a request it has just put away, so it can be brought back', async () => {
    const { screen, device } = await render({
      ...held,
      enrollments: [anEnrollment({ status: 'declined' })],
    })

    await act(screen)

    expect(device.education.enrollments.getById).toHaveBeenCalledWith('enrollment-1')
    expect(screen.text()).toContain('Bring back')
  })

  it('offers to ask again only once the request has ended', async () => {
    const { screen } = await render({
      ...held,
      enrollments: [anEnrollment({ status: 'declined' })],
    })

    expect(screen.find('a[href="/s/GITA/c/course-1/enroll"]').exists()).toBe(true)
  })

  it('leaves a live request to be answered rather than repeated', async () => {
    const { screen } = await render()

    expect(screen.find('a[href="/s/GITA/c/course-1/enroll"]').exists()).toBe(false)
  })

  it('answers nothing from a tab that is not the one keeping the data', async () => {
    const { screen } = await render(held, false)

    expect(screen.text()).toContain(translate('place-elsewhere'))
    expect(screen.text()).not.toContain('Cancel the request')
  })

  it('says the answer could not be written rather than pretending it was', async () => {
    const { screen, device } = await render({
      ...held,
      enrollments: [anEnrollment({ status: 'declined' })],
    })
    vi.mocked(device.writes.archive).mockRejectedValueOnce(new Error('no room'))

    await act(screen)

    expect(screen.text()).toContain('could not be saved')
  })

  it('says nothing was ever asked for when this course carries no request', async () => {
    const { screen } = await render({ schools: [aSchool()], courses: [aCourse()] })

    expect(screen.text()).toContain('have not asked for a place')
  })

  it('promises the requests are coming while no run has finished here', async () => {
    siteStandsAt()

    const { screen } = await render({ schools: [aSchool()], courses: [aCourse()] })

    expect(screen.text()).toContain('on their way')
    expect(screen.text()).not.toContain('have not asked for a place')
  })
})
