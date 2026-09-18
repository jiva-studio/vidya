// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import LessonContentGate from '../components/Content/LessonContentGate.vue'
import UnsupportedSchemaNotice from '../components/Content/UnsupportedSchemaNotice.vue'
import { fluentFor } from './fluentFor'

const lesson = '<article>Section one</article>'

const render = (contentSchemaVersion: number) =>
  mount(LessonContentGate, {
    props: { contentSchemaVersion, supportedSchemaVersion: 1 },
    slots: { default: lesson },
    global: { plugins: [fluentFor('en')] },
  })

/**
 * T-U-5, AC-22e, D-9. Lesson content of a shape this build does not know.
 *
 * The content is kept whole on the device — nothing is discarded — and the
 * screen declines to draw what it cannot read, asking for a newer app instead
 * of guessing at unknown fields.
 */
describe('T-U-5: content newer than the app', () => {
  it('draws a lesson of a known shape', () => {
    const wrapper = render(1)

    expect(wrapper.text()).toContain('Section one')
    expect(wrapper.findComponent(UnsupportedSchemaNotice).exists()).toBe(false)
  })

  it('asks for a newer app when the shape is unknown', () => {
    const wrapper = render(2)

    expect(wrapper.findComponent(UnsupportedSchemaNotice).exists()).toBe(true)
    expect(wrapper.text().toLowerCase()).toContain('update the app')
  })

  it('does not try to draw what it cannot read', () => {
    expect(render(2).text()).not.toContain('Section one')
  })

  it('passes the update request up to whoever can act on it', async () => {
    const wrapper = render(2)
    await wrapper.find('ion-button').trigger('click')

    expect(wrapper.emitted('update-app')).toHaveLength(1)
  })
})
