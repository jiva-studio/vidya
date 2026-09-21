import { SubmissionStates } from '@vidya/client'
import { HomeworkStatuses, SyncRejectionReasons } from '@vidya/domain'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { enBundle, fluent, ruBundle } from '@/shared/i18n'
import { describeAnswer, describeSubmission } from '@/shared/lib'
import { SubmissionNotice } from '@/shared/ui'

const draw = (props: { state: 'notSent' | 'rejected'; reason?: 'alreadyAccepted' }) =>
  mount(SubmissionNotice, { props, global: { plugins: [fluent] } })

describe('where a record stands', () => {
  it('says the record is here and has not gone out', () => {
    const screen = draw({ state: 'notSent' })

    expect(screen.text()).toContain('Not sent')
    expect(screen.text()).toContain('as soon as there is a connection')
  })

  it('names why the school refused it, beside the record itself', () => {
    const screen = draw({ state: 'rejected', reason: 'alreadyAccepted' })

    expect(screen.get('[data-reason]').text()).toContain('already been accepted')
    expect(screen.text()).toContain('Nothing has been lost')
  })

  it('names no reason where there is none to name', () => {
    expect(draw({ state: 'rejected' }).find('[data-reason]').exists()).toBe(false)
  })
})

/**
 * The keys these three build are assembled at runtime, so the bundle check
 * that walks the sources cannot see them. They are checked here instead,
 * against both bundles, because a key missing from one shows the student a
 * name where a sentence should be.
 */
describe('the words for every state a record can be in', () => {
  const held = (key: string) => enBundle.hasMessage(key) && ruBundle.hasMessage(key)

  it('covers every journey a record can make', () => {
    const missing = SubmissionStates.flatMap((state) =>
      [describeSubmission(state).key, describeSubmission(state).hintKey].filter(
        (key) => !held(key),
      ),
    )

    expect(missing).toEqual([])
  })

  it('covers every reason the school can refuse one for', () => {
    const missing = SyncRejectionReasons.filter((reason) => !held(`sync-rejection-${reason}`))

    expect(missing).toEqual([])
  })

  it('covers every standing an answer can have', () => {
    const missing = HomeworkStatuses.filter((status) => !held(describeAnswer(status).key))

    expect(missing).toEqual([])
  })
})
