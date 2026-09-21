import '../../../../../../libs/ui/vitest.setup'

import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { addMessages, translate } from '@/shared/i18n'
import { mountWithApp } from '@/shared/testing'

import ModerationActions from '../ui/ModerationActions.vue'

const copy = `
enrollments-accept = Accept
enrollments-decline = Decline
enrollments-decline-title = Decline this request?
enrollments-decline-consequence = A decision cannot be undone. The student would have to ask again.
enrollments-restore = Give the place back
enrollments-restore-title = Give this student their place back?
enrollments-restore-consequence = The student can study the course again.
enrollments-assign-group = Group
action-cancel = Cancel
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

    expect(shown).toContain(translate('enrollments-restore'))
    expect(shown).not.toContain(translate('enrollments-decline'))
    expect(shown).not.toContain(translate('enrollments-accept'))
  })

  it('offers it to nobody without the permission to moderate', () => {
    expect(labels(mount('revoked', false))).toEqual([])
  })

  it('offers the same way back to a student who left of their own accord', () => {
    const shown = labels(mount('withdrawn'))

    expect(shown).toContain(translate('enrollments-restore'))
    expect(shown).not.toContain(translate('enrollments-decline'))
    expect(shown).not.toContain(translate('enrollments-accept'))
  })

  it('offers nothing of the kind on a place that was refused on its merits', () => {
    expect(labels(mount('declined'))).not.toContain(translate('enrollments-restore'))
  })

  it('leaves a request that is still open to be accepted or refused', () => {
    const shown = labels(mount('pending'))

    expect(shown).toEqual(
      expect.arrayContaining([translate('enrollments-accept'), translate('enrollments-decline')]),
    )
    expect(shown).not.toContain(translate('enrollments-restore'))
  })

  it('asks before giving the place back, and only then decides', async () => {
    const page = mount('revoked')

    await clickLabelled(page, translate('enrollments-restore'))

    expect(page.emitted('accept')).toBeUndefined()
    expect(document.body.textContent).toContain(translate('enrollments-restore-consequence'))

    const confirm = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent?.trim() === translate('enrollments-restore'),
    )
    confirm?.click()
    await flushPromises()

    expect(page.emitted('accept')).toEqual([['e1']])
  })
})
