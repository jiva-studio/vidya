import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import CourseCoverPlaceholder from '../ui/CourseCoverPlaceholder.vue'

describe('CourseCoverPlaceholder', () => {
  it('renders default title "Cover" in SVG text', () => {
    const wrapper = mount(CourseCoverPlaceholder)
    expect(wrapper.find('[data-test="course-cover-placeholder"]').exists()).toBe(true)
    expect(wrapper.find('text').text()).toBe('Cover')
  })

  it('renders custom title prop', () => {
    const wrapper = mount(CourseCoverPlaceholder, {
      props: {
        title: 'Custom Title',
      },
    })
    expect(wrapper.find('text').text()).toBe('Custom Title')
  })

  it('applies custom class prop to container', () => {
    const wrapper = mount(CourseCoverPlaceholder, {
      props: {
        class: 'custom-preview-class',
      },
    })
    expect(wrapper.find('[data-test="course-cover-placeholder"]').classes()).toContain(
      'custom-preview-class',
    )
  })
})
