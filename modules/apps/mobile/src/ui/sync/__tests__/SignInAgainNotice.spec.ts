// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import SignInAgainNotice from '../components/Availability/SignInAgainNotice.vue'
import { fluentFor, type Locale } from './fluentFor'

const render = (schools = 1, locale: Locale = 'en') =>
  mount(SignInAgainNotice, { props: { schools }, global: { plugins: [fluentFor(locale)] } })

/**
 * A school that stopped accepting the sign-in it was given.
 *
 * What broke is the network half of one connection: nothing new arrives from
 * that school and nothing leaves for it. Everything already on the device goes
 * on reading, and the student's other schools go on syncing — so the notice
 * says how much is affected and says plainly what still works, rather than
 * announcing a failure of the app.
 */
describe('a school that needs a new sign-in is explained', () => {
  it('says what stopped: new material in, applications out', () => {
    expect(render().text()).toContain('new lessons and courses')
    expect(render().text()).toContain('applications will not be sent')
  })

  it('says downloaded material still opens, rather than leaving that to be feared', () => {
    expect(render().text()).toContain('Everything already downloaded opens and reads as usual')
  })

  it('speaks of one school when one is waiting', () => {
    expect(render(1).text()).toContain('This school stopped accepting')
  })

  it('counts the schools when more than one is waiting, rather than damning them all', () => {
    const text = render(3).text()

    expect(text).toContain('3 of your schools')
    expect(text).not.toContain('This school stopped accepting')
  })

  it('offers the way back in', async () => {
    const wrapper = render()

    await wrapper.find('ion-button').trigger('click')

    expect(wrapper.emitted('sign-in')).toHaveLength(1)
  })

  it('speaks Russian too', () => {
    expect(render(1, 'ru').text()).toContain('Нужно войти снова')
  })
})
