import type { HttpClient } from '@vidya/client'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type RouteRecordRaw } from 'vue-router'

import { messages as joinMessages } from '@/features/join-school'
import { httpClientKey } from '@/shared/api'
import { useConnection } from '@/shared/connection'
import { addMessages, fluent } from '@/shared/i18n'

import { routes } from '../routes'

addMessages(joinMessages)

const http = { get: vi.fn(), post: vi.fn() }

const openJoinPage = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [...(routes as RouteRecordRaw[]), { path: '/login', name: 'login', component: {} }],
  })

  await router.push('/j/GITA42')
  await router.isReady()

  const screen = mount(
    { template: '<RouterView />' },
    {
      global: {
        plugins: [router, fluent],
        provide: { [httpClientKey as symbol]: http as unknown as HttpClient },
      },
    },
  )

  await flushPromises()
  return { screen, router }
}

/**
 * The address a school prints. It has to open for somebody who has never been
 * here, and signing in from it has to come back to it.
 */
describe('the joining address', () => {
  beforeEach(() => {
    localStorage.clear()
    useConnection().signOut()
    http.get.mockReset().mockResolvedValue({ id: 'school-1', name: 'Gita School', logoUrl: null })
    http.post.mockReset()
  })

  it('resolves the code in the address, before there is a session', async () => {
    const { screen } = await openJoinPage()

    expect(http.get).toHaveBeenCalledWith('/j/GITA42')
    expect(screen.text()).toContain('Gita School')
  })

  it('sends a visitor to sign in and back to this school, not to the front page', async () => {
    const { screen, router } = await openJoinPage()

    await screen.get('button').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('login')
    expect(router.currentRoute.value.query.redirect).toBe('/j/GITA42')
  })
})
