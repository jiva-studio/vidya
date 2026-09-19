import '../../../../../../libs/ui/vitest.setup'

import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { addMessages } from '@/shared/i18n'
import { mountWithApp } from '@/shared/testing'

import ModerationActions from '../ui/ModerationActions.vue'

const copy = `
enrollments-accept = Принять
enrollments-decline = Отклонить
enrollments-decline-title = Отклонить заявку?
enrollments-decline-consequence = Решение не изменить.
enrollments-restore = Вернуть на курс
enrollments-restore-title = Вернуть студента на курс?
enrollments-restore-consequence = Место вернётся вместе с доступом к курсу.
enrollments-assign-group = Группа
action-cancel = Отмена
`

const row = (status: string) => ({
  id: 'e1',
  courseId: 'c1',
  studentId: 'u1',
  schoolId: 'school-1',
  status,
  createdAt: '2026-09-01T10:00:00.000Z',
})

const mount = (status: string, canModerate = true) =>
  mountWithApp(ModerationActions, {
    props: { enrollment: row(status) as never, canModerate },
  })

const labels = (page: ReturnType<typeof mount>) =>
  page.findAll('button').map((button) => button.attributes('aria-label') ?? button.text())

const clickLabelled = async (page: ReturnType<typeof mount>, label: string) => {
  await page
    .findAll('button')
    .find((button) => (button.attributes('aria-label') ?? button.text()) === label)
    ?.trigger('click')
  await flushPromises()
}

/**
 * The console must offer exactly the moves the server's transition table has.
 * Offering one it does not leaves a moderator clicking into a 409.
 */
describe('giving back a place the school took away', () => {
  beforeEach(() => {
    addMessages({ en: copy, ru: copy })
  })

  it('offers the way back on a revoked place, and no way to refuse it', () => {
    const shown = labels(mount('revoked'))

    expect(shown).toContain('Вернуть на курс')
    expect(shown).not.toContain('Отклонить')
    expect(shown).not.toContain('Принять')
  })

  it('offers it to nobody without the permission to moderate', () => {
    expect(labels(mount('revoked', false))).toEqual([])
  })

  it('offers nothing of the kind on a place that was refused on its merits', () => {
    expect(labels(mount('declined'))).not.toContain('Вернуть на курс')
  })

  it('leaves a request that is still open to be accepted or refused', () => {
    const shown = labels(mount('pending'))

    expect(shown).toEqual(expect.arrayContaining(['Принять', 'Отклонить']))
    expect(shown).not.toContain('Вернуть на курс')
  })

  it('asks before giving the place back, and only then decides', async () => {
    const page = mount('revoked')

    await clickLabelled(page, 'Вернуть на курс')

    expect(page.emitted('accept')).toBeUndefined()
    expect(document.body.textContent).toContain('Место вернётся')

    const confirm = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === 'Вернуть на курс',
    )
    confirm?.click()
    await flushPromises()

    expect(page.emitted('accept')).toEqual([['e1']])
  })
})
