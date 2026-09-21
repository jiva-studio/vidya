import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { defineComponent } from 'vue'

import { educationKey, useLocalEducation } from '../useLocalEducation'
import { fakeDevice } from './fakeDevice'

const read = (provide: Record<symbol, unknown>) =>
  mount(
    defineComponent({
      setup() {
        useLocalEducation()
        return () => null
      },
    }),
    { global: { provide } },
  )

describe('reading the material this machine holds', () => {
  it('hands the screen the repositories the composition root built', () => {
    const device = fakeDevice()

    expect(() => read({ [educationKey as symbol]: device.education })).not.toThrow()
  })

  it('refuses to answer from nowhere when nothing was provided', () => {
    expect(() => read({})).toThrow('no local education')
  })
})
