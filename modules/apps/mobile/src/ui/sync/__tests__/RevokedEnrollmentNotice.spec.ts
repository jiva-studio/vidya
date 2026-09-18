// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import RevokedEnrollmentNotice from '../components/Availability/RevokedEnrollmentNotice.vue'
import { fluentFor } from './fluentFor'

const render = (hasDownloadedContent = true) =>
  mount(RevokedEnrollmentNotice, {
    props: { courseName: 'Bhagavad-gita', hasDownloadedContent },
    global: { plugins: [fluentFor('en')] },
  })

/**
 * A course the student was withdrawn from.
 *
 * Withdrawal ends what the network will accept, not what the device holds:
 * reading downloaded content is unconditional, so the course is explained and
 * stays open rather than quietly disappearing.
 */
describe('a withdrawn enrolment is explained', () => {
  it('names the course it is talking about', () => {
    expect(render().text()).toContain('Bhagavad-gita')
  })

  it('says the enrolment ended rather than leaving a blank', () => {
    expect(render().text().toLowerCase()).toContain('no longer enrolled')
  })

  it('promises that what was downloaded is still readable', () => {
    expect(render().text().toLowerCase()).toContain('stays readable')
  })

  it('offers the downloaded content when there is any', async () => {
    const wrapper = render(true)
    await wrapper.find('ion-button').trigger('click')

    expect(wrapper.emitted('open-downloaded')).toHaveLength(1)
  })

  it('offers nothing to open when nothing was downloaded', () => {
    expect(render(false).find('ion-button').exists()).toBe(false)
  })
})
