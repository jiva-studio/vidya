// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import MissingLessonVersionNote from '../components/Outbox/MissingLessonVersionNote.vue'
import SubmittedHomeworkItem from '../components/Outbox/SubmittedHomeworkItem.vue'
import SyncRejectionNotice from '../components/Outbox/SyncRejectionNotice.vue'
import type { SubmittedHomeworkItemProps } from '../components/Outbox/types'
import { fluentFor } from './fluentFor'

const answerText = 'Krishna is the origin of everything'

const render = (props: Partial<SubmittedHomeworkItemProps> = {}) =>
  mount(SubmittedHomeworkItem, {
    props: { answerText, state: 'notSent', ...props },
    global: { plugins: [fluentFor('en')] },
  })

/**
 * An answer whose lesson version has not arrived yet.
 *
 * Scope positions move independently and the device schema has no foreign keys,
 * so homework can legitimately reach the device before the lesson version it
 * answers. The row has to survive the missing parent: a stand-in, never a crash
 * and never a blank screen.
 */
describe('an answer without its lesson version', () => {
  it('stands in for the lesson instead of rendering nothing', () => {
    const wrapper = render({ lessonTitle: undefined })

    expect(wrapper.findComponent(MissingLessonVersionNote).exists()).toBe(true)
    expect(wrapper.text().length).toBeGreaterThan(0)
  })

  it('still shows the work itself, which is what the student would miss', () => {
    expect(render({ lessonTitle: undefined }).text()).toContain(answerText)
  })

  it('drops the stand-in once the lesson has arrived', () => {
    const wrapper = render({ lessonTitle: 'Lesson 1' })

    expect(wrapper.findComponent(MissingLessonVersionNote).exists()).toBe(false)
    expect(wrapper.text()).toContain('Lesson 1')
  })

  it('shows a refusal in the row, not over it', () => {
    const wrapper = render({ state: 'rejected', reason: 'alreadyAccepted' })

    expect(wrapper.findComponent(SyncRejectionNotice).exists()).toBe(true)
    expect(wrapper.text()).toContain(answerText)
  })
})
