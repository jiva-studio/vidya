// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CourseCard from '../components/Courses/CourseCard.vue'
import { coverToneOf, coverToneRgb } from '../model/courseCovers'

const NAME = 'Sanskrit, first steps'

const render = (props: Record<string, unknown> = {}) =>
  mount(CourseCard, { props: { name: NAME, ...props } })

/**
 * The course's name is read off its cover, the way a cover is read anywhere
 * else. What is behind the name is a picture once there is one and a tone of
 * the palette until then, so the darkening that keeps the name legible has to
 * be there in both cases rather than arrive with the picture.
 */
describe('a course card carries its name on the cover', () => {
  it('draws the name over the cover rather than in a strip below it', () => {
    const wrapper = render()

    expect(wrapper.find('.cover .cover-title').text()).toBe(NAME)
  })

  it('darkens the cover under the name, whatever is behind it', () => {
    expect(render().find('.cover .scrim').exists()).toBe(true)
    expect(render({ coverUrl: 'blob:cover' }).find('.cover .scrim').exists()).toBe(true)
  })

  it('paints the cover in the tone the course was given', () => {
    const style = render().find('.cover').attributes('style')

    expect(style).toContain(coverToneRgb(coverToneOf(NAME)))
  })

  it('gives the letter up to a picture once the course has one', () => {
    const wrapper = render({ coverUrl: 'blob:cover' })

    expect(wrapper.find('.cover-initial').exists()).toBe(false)
    expect(wrapper.find('.cover > img').attributes('src')).toBe('blob:cover')
  })
})

/**
 * The description is cut by lines rather than by characters, which is a
 * property of the stylesheet and not of the markup. What the markup owes it is
 * the box the cut hangs on — and nothing at all when there is no description,
 * so a course without one does not leave a gap under its cover.
 */
describe('a course card shows as much of the description as it has room for', () => {
  it('hangs the description on a box of its own for the line cut', () => {
    const wrapper = render({ description: 'The alphabet, sandhi and the first verses.' })

    expect(wrapper.find('ion-card-content .description').text()).toBe(
      'The alphabet, sandhi and the first verses.',
    )
  })

  it('leaves the strip out of a course that has no description', () => {
    expect(render().find('ion-card-content').exists()).toBe(false)
  })
})
