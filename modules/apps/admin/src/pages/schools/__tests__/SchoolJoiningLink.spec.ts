import type { SchoolId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { httpClientKey, resetApi } from '@/shared/api'
import { addMessages, locale } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, mountWithApp, refusal, signInAs } from '@/shared/testing'

import { messages } from '../i18n'
import SchoolJoiningLink from '../ui/SchoolJoiningLink.vue'

addMessages(messages)

const SCHOOL = asId<SchoolId>('school-1')
const CODE = '/edu/schools/school-1/code'

const open = (answers: FakeAnswers) => {
  const transport = fakeHttpClient(answers)
  const section = mountWithApp(SchoolJoiningLink, {
    props: { id: SCHOOL },
    global: { provide: { [httpClientKey as symbol]: transport.client } },
  })

  return { transport, section }
}

const press = async (section: ReturnType<typeof open>['section'], label: string): Promise<void> => {
  const button = section.findAll('button').find((candidate) => candidate.text() === label)
  await button?.trigger('click')
  await flushPromises()
}

describe('SchoolJoiningLink', () => {
  beforeEach(() => {
    localStorage.clear()
    resetApi()
    useSession().end()
    signInAs([])
    locale.value = 'en'
  })

  it('creates no code until somebody asks for the link', () => {
    const { transport } = open({ [CODE]: { code: 'AB3K7Q' } })

    expect(transport.calls).toHaveLength(0)
  })

  it('asks the school for its code when the link is wanted', async () => {
    const { transport, section } = open({ [CODE]: { code: 'AB3K7Q' } })

    await press(section, 'Get the link')

    expect(transport.calls[0]).toMatchObject({ method: 'POST', path: CODE })
  })

  it('shows the link that is handed out, not the bare code', async () => {
    const { section } = open({ [CODE]: { code: 'AB3K7Q' } })

    await press(section, 'Get the link')

    const shown = section.find('input').element as HTMLInputElement
    expect(shown.value).toBe('http://localhost:7814/j/AB3K7Q')
  })

  it('puts the link on the clipboard when it is copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })

    const { section } = open({ [CODE]: { code: 'AB3K7Q' } })
    await press(section, 'Get the link')
    await press(section, 'Copy')

    expect(writeText).toHaveBeenCalledWith('http://localhost:7814/j/AB3K7Q')
    expect(section.text()).toContain('The link is copied.')
  })

  it('names the setting a school without a student role is missing', async () => {
    const { section } = open({ [CODE]: refusal(409, 'The school has no role to give a student') })

    await press(section, 'Get the link')

    expect(section.text()).toContain('The school has no role for a new student yet')
    expect(section.find('input').exists()).toBe(false)
  })

  it('offers the screen that fills the missing setting', async () => {
    const { section } = open({ [CODE]: refusal(409, 'The school has no role to give a student') })

    await press(section, 'Get the link')

    expect(section.findComponent({ name: 'RouterLink' }).props('to')).toEqual({
      name: 'school-settings',
      params: { id: SCHOOL },
    })
  })

  it('keeps the servers own words for the refusal off the screen', async () => {
    const { section } = open({ [CODE]: refusal(409, 'The school has no role to give a student') })

    await press(section, 'Get the link')

    expect(section.text()).not.toContain('The school has no role to give a student')
  })

  it('reports a refusal that is not about the missing role', async () => {
    const { section } = open({ [CODE]: refusal(503, 'The database is asleep') })

    await press(section, 'Get the link')

    expect(section.text()).toContain('The server could not do this.')
    expect(section.text()).not.toContain('Choose the role in the school settings')
  })

  it('says in Russian what a school without a student role has to do', async () => {
    locale.value = 'ru'
    const { section } = open({ [CODE]: refusal(409, 'The school has no role to give a student') })
    await flushPromises()

    await press(section, 'Получить ссылку')

    expect(section.text()).toContain('В школе ещё не выбрана роль для нового студента')
  })
})
