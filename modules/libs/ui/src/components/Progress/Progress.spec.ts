import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import Progress from './Progress.vue'

function mountProgress(value: number) {
  return mount(Progress, { props: { value, label: 'Uploading' } })
}

describe('Progress', () => {
  it('reports the figure to assistive technology', () => {
    const bar = mountProgress(42).get('[role="progressbar"]')

    expect(bar.attributes('aria-valuenow')).toBe('42')
    expect(bar.attributes('aria-label')).toBe('Uploading')
    expect(bar.attributes('aria-valuemin')).toBe('0')
    expect(bar.attributes('aria-valuemax')).toBe('100')
  })

  it('fills the track in proportion to the figure', () => {
    expect(mountProgress(42).get('[role="progressbar"] > div').attributes('style')).toContain(
      'width: 42%',
    )
  })

  it('never reports more than complete', () => {
    expect(mountProgress(140).get('[role="progressbar"]').attributes('aria-valuenow')).toBe('100')
  })

  it('never reports less than nothing', () => {
    expect(mountProgress(-20).get('[role="progressbar"]').attributes('aria-valuenow')).toBe('0')
  })
})
