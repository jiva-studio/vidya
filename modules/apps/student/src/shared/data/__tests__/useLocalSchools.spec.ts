import type { ISchoolRepository } from '@vidya/client'
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent } from 'vue'

import { schoolRepositoryKey, useLocalSchools } from '../useLocalSchools'

const read = (provide: Record<symbol, unknown>) =>
  mount(
    defineComponent({
      setup() {
        useLocalSchools()
        return () => null
      },
    }),
    { global: { provide } },
  )

describe('reading the schools this machine holds', () => {
  it('hands the screen the repository the composition root built', () => {
    const repository = { list: vi.fn(), getById: vi.fn() } as unknown as ISchoolRepository

    expect(() => read({ [schoolRepositoryKey as symbol]: repository })).not.toThrow()
  })

  it('refuses to answer from nowhere when nothing was provided', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(() => read({})).toThrow('no local schools')
  })
})
