import type { ISchoolRepository, LocalSchool } from '@vidya/client'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { schoolRepositoryKey } from '@/shared/data'
import { fluent } from '@/shared/i18n'
import { useSiteStatus } from '@/shared/status'

import LearningPage from '../ui/LearningPage.vue'

const repository = { list: vi.fn(), getById: vi.fn() }

const render = async () => {
  const screen = mount(LearningPage, {
    global: {
      plugins: [fluent],
      provide: { [schoolRepositoryKey as symbol]: repository as unknown as ISchoolRepository },
    },
  })

  await flushPromises()
  return screen
}

const gita = { id: 'school-1', name: 'Gita School', logoUrl: null, description: null }

describe('the learning screen with nothing on it', () => {
  beforeEach(() => {
    repository.list.mockReset().mockResolvedValue([] as LocalSchool[])
    useSiteStatus().runFinished(0, false)
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('promises the courses are coming while the first run is still going', async () => {
    const screen = await render()

    expect(screen.text()).toContain('Your courses are on their way')
    expect(screen.text()).not.toContain('Nobody has invited you')
  })

  it('reads the schools again as synchronisation brings more', async () => {
    const screen = await render()
    repository.list.mockResolvedValue([gita])

    useSiteStatus().runFinished(12, true)
    await flushPromises()

    expect(screen.text()).not.toContain('Your courses are on their way')
    expect(repository.list).toHaveBeenCalledTimes(2)
  })

  it('says nobody invited them once a finished run has found no school', async () => {
    useSiteStatus().runFinished(0, true)

    const screen = await render()

    expect(screen.text()).toContain('Nobody has invited you anywhere')
    expect(screen.text()).toContain('Ask your school')
  })

  it('survives a database whose schema another tab has not created yet', async () => {
    repository.list.mockRejectedValue(new Error('no such table: sync_rows'))

    const screen = await render()

    expect(screen.text()).toContain('My learning')
  })
})
