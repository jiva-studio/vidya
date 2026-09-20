// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import CourseCard from '../components/Courses/CourseCard.vue'

const LOGO = '[data-testid="school-logo"]'

const render = (props: Record<string, unknown>) =>
  mount(CourseCard, { props: { name: 'Sanskrit for beginners', ...props } })

afterEach(() => vi.restoreAllMocks())

/**
 * A card is drawn from what the device happens to hold, which is never
 * guaranteed to be everything.
 *
 * Scope positions advance on their own, so a course can arrive before the
 * school it belongs to; and the logo is a link rather than stored bytes, so
 * offline it never resolves at all. Both are ordinary, and neither may cost the
 * student the card.
 */
describe('a course card draws what is there', () => {
  it('names the course even when its school has not arrived', () => {
    const wrapper = render({ schoolName: undefined, schoolLogoUrl: null })

    expect(wrapper.text()).toContain('Sanskrit for beginners')
  })

  it('leaves the logo out rather than reaching for a school it does not have', () => {
    const wrapper = render({ schoolName: undefined, schoolLogoUrl: null })

    expect(wrapper.find(LOGO).exists()).toBe(false)
  })

  it('draws a course with no school without complaining to the console', () => {
    const complaints = vi.spyOn(console, 'error').mockImplementation(() => undefined)

    render({ schoolName: undefined, schoolLogoUrl: null })

    expect(complaints).not.toHaveBeenCalled()
  })

  it('shows the logo the school gave', () => {
    const wrapper = render({
      schoolName: 'School of Devotion',
      schoolLogoUrl: 'https://cdn.example.org/logos/devotion.png',
    })

    expect(wrapper.find(LOGO).attributes('data-state')).toBe('image')
    expect(wrapper.find(`${LOGO} img`).attributes('src')).toBe(
      'https://cdn.example.org/logos/devotion.png',
    )
  })

  it('falls back to the initial when the logo does not load', async () => {
    const wrapper = render({
      schoolName: 'School of Devotion',
      schoolLogoUrl: 'https://cdn.example.org/logos/devotion.png',
    })

    await wrapper.find(`${LOGO} img`).trigger('error')

    expect(wrapper.find(LOGO).attributes('data-state')).toBe('initial')
    expect(wrapper.find(LOGO).text()).toBe('S')
  })

  it('shows the initial straight away for a school that gave no logo', () => {
    const wrapper = render({ schoolName: 'Bhakti School', schoolLogoUrl: null })

    expect(wrapper.find(LOGO).attributes('data-state')).toBe('initial')
    expect(wrapper.find(LOGO).text()).toBe('B')
  })

  it('raises the initial to a capital, whatever case the school writes its name in', () => {
    // A badge is a capital in a circle. A school that spells itself in lower
    // case gets one anyway, rather than a card that looks like a typing error.
    const wrapper = render({ schoolName: 'bhakti yoga school', schoolLogoUrl: null })

    expect(wrapper.find(LOGO).text()).toBe('B')
  })

  it('tries again when the school sends a different logo', async () => {
    // A failure belongs to the address that failed. A run that brings a new one
    // has to be given its chance, or one bad link fixed upstream stays a letter
    // on the device until the app is restarted.
    const wrapper = render({
      schoolName: 'School of Devotion',
      schoolLogoUrl: 'https://cdn.example.org/logos/gone.png',
    })
    await wrapper.find(`${LOGO} img`).trigger('error')
    expect(wrapper.find(LOGO).attributes('data-state')).toBe('initial')

    await wrapper.setProps({ schoolLogoUrl: 'https://cdn.example.org/logos/devotion.png' })

    expect(wrapper.find(LOGO).attributes('data-state')).toBe('image')
    expect(wrapper.find(`${LOGO} img`).attributes('src')).toBe(
      'https://cdn.example.org/logos/devotion.png',
    )
  })

  it('keeps the letter while the same logo stays broken', async () => {
    const wrapper = render({
      schoolName: 'School of Devotion',
      schoolLogoUrl: 'https://cdn.example.org/logos/gone.png',
    })
    await wrapper.find(`${LOGO} img`).trigger('error')

    await wrapper.setProps({ schoolName: 'School of Devotion (renamed)' })

    expect(wrapper.find(LOGO).attributes('data-state')).toBe('initial')
  })

  it('keeps the same box either way, so nothing moves when the logo fails', async () => {
    const wrapper = render({
      schoolName: 'School of Devotion',
      schoolLogoUrl: 'https://cdn.example.org/logos/devotion.png',
    })
    const before = wrapper.find(LOGO).attributes('class')

    await wrapper.find(`${LOGO} img`).trigger('error')

    expect(wrapper.find(LOGO).exists()).toBe(true)
    expect(wrapper.find(LOGO).attributes('class')).toBe(before)
  })
})
