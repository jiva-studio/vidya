import { type HttpClient, HttpError, type LocalSchool } from '@vidya/client'
import { asId, type SchoolId } from '@vidya/domain'
import { AlertDialog } from '@vidya/ui'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { httpClientKey } from '@/shared/api'
import { useConnection } from '@/shared/connection'
import { addMessages, fluent } from '@/shared/i18n'

import { messages } from '..'
import LeaveSchoolPanel from '../ui/LeaveSchoolPanel.vue'

const school: LocalSchool = {
  id: asId<SchoolId>('school-1'),
  name: 'Gita School',
  logoUrl: null,
  description: null,
  code: 'GITA',
}

const render = (places = 0, http = { delete: vi.fn() }) => {
  const screen = mount(LeaveSchoolPanel, {
    props: { school, places },
    global: {
      plugins: [fluent],
      provide: { [httpClientKey as symbol]: http as unknown as HttpClient },
    },
  })

  return { screen, http }
}

const asked = (screen: VueWrapper) => screen.findComponent(AlertDialog)

const clickLeave = async (screen: VueWrapper) => {
  await screen.find('button').trigger('click')
  await flushPromises()
}

const sayYes = async (screen: VueWrapper) => {
  asked(screen).vm.$emit('confirm')
  await flushPromises()
}

describe('the school a student is leaving', () => {
  beforeEach(() => {
    addMessages(messages)
    localStorage.clear()
    const connection = useConnection()
    connection.signOut()
    connection.offer({ accessToken: 'access', refreshToken: 'refresh' })
    connection.signIn(asId('user-1'))
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('names the school it is about', () => {
    const { screen } = render()

    expect(screen.text()).toContain('Gita School')
  })

  it('asks before leaving, and asks nothing of the server until it is answered', async () => {
    const { screen, http } = render()

    await clickLeave(screen)

    expect(asked(screen).props('open')).toBe(true)
    expect(http.delete).not.toHaveBeenCalled()
  })

  it('says what the departure costs in places, before it costs them', async () => {
    const { screen } = render(2)

    await clickLeave(screen)

    expect(asked(screen).props('description')).toContain('2')
  })

  it('says nothing about places where the student holds none', async () => {
    const { screen } = render(0)

    await clickLeave(screen)

    expect(asked(screen).props('description')).not.toContain('0')
  })

  it('leaves once the student has said yes', async () => {
    const { screen, http } = render()

    await clickLeave(screen)
    await sayYes(screen)

    expect(http.delete).toHaveBeenCalledWith('/edu/users/user-1/schools/school-1')
  })

  it('says an owner has to hand the school over first', async () => {
    const http = { delete: vi.fn().mockRejectedValue(new HttpError(409, '/edu')) }
    const { screen } = render(0, http)

    await clickLeave(screen)
    await sayYes(screen)

    expect(screen.text()).toContain('own this school')
    expect(screen.text()).not.toContain('went wrong')
  })

  it('offers another try where the server merely could not be reached', async () => {
    const http = { delete: vi.fn().mockRejectedValue(new HttpError(500, '/edu')) }
    const { screen } = render(0, http)

    await clickLeave(screen)
    await sayYes(screen)

    expect(screen.text()).toContain('could not be left')
  })

  it('says the school is gone once the server has taken the membership back', async () => {
    const { screen } = render()

    await clickLeave(screen)
    await sayYes(screen)

    expect(screen.text()).toContain('no longer in this school')
  })
})
