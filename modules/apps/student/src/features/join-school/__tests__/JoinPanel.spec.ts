import { type HttpClient, HttpError } from '@vidya/client'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { httpClientKey } from '@/shared/api'
import { useConnection } from '@/shared/connection'
import { translate } from '@/shared/i18n'
import { addMessages, fluent } from '@/shared/i18n'
import { useSiteStatus } from '@/shared/status'

import { messages } from '../i18n'
import { JoinPanel } from '../ui'

addMessages(messages)

const school = { id: 'school-1', name: 'Gita School', logoUrl: null }

const http = { get: vi.fn(), post: vi.fn() }

const render = async () => {
  const screen = mount(JoinPanel, {
    props: { code: 'GITA42' },
    global: {
      plugins: [fluent],
      provide: { [httpClientKey as symbol]: http as unknown as HttpClient },
    },
  })

  await flushPromises()
  return screen
}

const signIn = () => {
  const connection = useConnection()
  connection.offer({ accessToken: 'access', refreshToken: 'refresh' })
  connection.signIn('user-1' as never)
}

/**
 * The first thing a person sees of Vidya, before they have an account and
 * before there is a database to read: the school behind the code, and one
 * thing to do about it.
 */
describe('the school page behind a joining link', () => {
  beforeEach(() => {
    localStorage.clear()
    useConnection().signOut()
    http.get.mockReset()
    http.post.mockReset()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('shows the school a stranger followed the link to', async () => {
    http.get.mockResolvedValue(school)

    const screen = await render()

    expect(screen.text()).toContain('Gita School')
  })

  it('offers signing in first when there is no session, and says so', async () => {
    http.get.mockResolvedValue(school)

    const screen = await render()
    expect(screen.text()).toContain(translate('join-sign-in'))

    await screen.get('button').trigger('click')

    expect(screen.emitted('sign-in')).toHaveLength(1)
    expect(http.post).not.toHaveBeenCalled()
  })

  it('joins for a signed-in student and allows proceeding to home', async () => {
    http.get.mockResolvedValue(school)
    http.post.mockResolvedValue({ success: true })
    signIn()

    const screen = await render()
    await screen.get('button').trigger('click')
    await flushPromises()

    expect(screen.emitted('sign-in')).toBeUndefined()
    expect(screen.text()).toContain(translate('join-joined'))

    await screen.get('button').trigger('click')
    expect(screen.emitted('joined')).toHaveLength(1)
  })

  it('shows the first backfill rather than a school that looks empty', async () => {
    http.get.mockResolvedValue(school)
    http.post.mockResolvedValue({ success: true })
    signIn()
    useSiteStatus().runStarted()

    const screen = await render()
    await screen.get('button').trigger('click')
    await flushPromises()

    expect(screen.text()).toContain(translate('waiting-title'))

    useSiteStatus().runFinished(0, false)
  })

  it('says a code nobody holds leads nowhere, and offers no way to join', async () => {
    http.get.mockRejectedValue(new HttpError(404, '/j/GITA42'))

    const screen = await render()

    expect(screen.text()).toContain(translate('join-unknown-title'))
    expect(screen.find('button').exists()).toBe(false)
  })

  it('explains a school that takes no students in words, never as a code', async () => {
    http.get.mockResolvedValue(school)
    http.post.mockRejectedValue(new HttpError(409, '/edu/users/user-1/schools'))
    signIn()

    const screen = await render()
    await screen.get('button').trigger('click')
    await flushPromises()

    expect(screen.text()).toContain(translate('join-closed-title'))
    expect(screen.text()).not.toContain('409')

    // Nothing to try again: the school, not the link, is what has to change.
    expect(screen.find('button').exists()).toBe(false)
  })

  it('offers another try when the school could not be reached at all', async () => {
    http.get.mockRejectedValueOnce(new HttpError(500, '/j/GITA42')).mockResolvedValue(school)

    const screen = await render()
    expect(screen.text()).toContain(translate('join-failed-title'))

    await screen.get('button').trigger('click')
    await flushPromises()

    expect(screen.text()).toContain('Gita School')
  })

  it('says the same things in Russian, which is what most students read', () => {
    const keys = (text: string) => [...text.matchAll(/^([a-z][\w-]*) *=/gm)].map((m) => m[1])

    expect(keys(messages.ru)).toEqual(keys(messages.en))
    expect(messages.ru).toContain('Школа пока не принимает студентов')
  })
})
