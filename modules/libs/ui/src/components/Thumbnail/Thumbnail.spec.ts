import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Thumbnail from './Thumbnail.vue'

describe('Thumbnail', () => {
  it('shows the picture it was given', () => {
    const wrapper = mount(Thumbnail, {
      props: { kind: 'image', src: '/media/1', alt: 'The temple at dawn' },
    })

    expect(wrapper.get('img').attributes('src')).toBe('/media/1')
    expect(wrapper.get('img').attributes('alt')).toBe('The temple at dawn')
  })

  it('names what is missing when it has no source', () => {
    const wrapper = mount(Thumbnail, { props: { kind: 'audio', alt: 'The morning kirtan' } })

    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.get('[role="img"]').attributes('aria-label')).toBe('The morning kirtan')
  })

  it('marks the tile the author picked', () => {
    const props = { kind: 'image', alt: 'The temple at dawn' } as const
    const plain = mount(Thumbnail, { props })
    const picked = mount(Thumbnail, { props: { ...props, selected: true } })

    expect(plain.classes()).not.toContain('border-[var(--color-primary)]')
    expect(picked.classes()).toContain('border-[var(--color-primary)]')
  })
})
