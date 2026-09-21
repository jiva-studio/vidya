import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useConnection } from '@/shared/connection'
import { fakeDevice } from '@/shared/data/__tests__/fakeDevice'
import { fluent } from '@/shared/i18n'

import SettingsPage from '../ui/SettingsPage.vue'

describe('the settings page', () => {
  let deleteDbSpy: ReturnType<typeof vi.fn>

  beforeEach(() => {
    localStorage.clear()
    deleteDbSpy = vi.fn()
    globalThis.indexedDB = { deleteDatabase: deleteDbSpy } as never
    const connection = useConnection()
    connection.offer({ accessToken: 'access', refreshToken: 'refresh' })
    connection.signIn('user-1' as never)
  })

  it('offers a way to sign out, which clears the session and local database', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/settings', name: 'settings', component: SettingsPage },
        { path: '/login', name: 'login', component: {} },
      ],
    })
    await router.push('/settings')
    await router.isReady()

    const device = fakeDevice({ schools: [] })
    const screen = mount(SettingsPage, {
      global: {
        plugins: [router, fluent],
        provide: { ...device.provide },
      },
    })
    await flushPromises()

    const signOutBtn = screen
      .findAll('button')
      .find(
        (btn) =>
          btn.text().toLowerCase().includes('sign out') ||
          btn.text().toLowerCase().includes('выйти'),
      )

    expect(signOutBtn).toBeDefined()
    await signOutBtn!.trigger('click')
    await flushPromises()

    expect(useConnection().isSignedIn.value).toBe(false)
    expect(deleteDbSpy).toHaveBeenCalledWith('vidya')
    expect(router.currentRoute.value.name).toBe('login')
  })
})
