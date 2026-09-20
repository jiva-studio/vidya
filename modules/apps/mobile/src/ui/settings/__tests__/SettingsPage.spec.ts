// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ref } from 'vue'

const connections = ref<Array<{ baseUrl: string }>>([])
const signOut = vi.fn(async (baseUrl: string) => {
  connections.value = connections.value.filter((one) => one.baseUrl !== baseUrl)
})
const navigate = vi.fn()

vi.mock('@/app', () => ({ useConnections: () => ({ connections, signOut }) }))
vi.mock('@ionic/vue', async () => ({
  ...(await vi.importActual<Record<string, unknown>>('@ionic/vue')),
  useIonRouter: () => ({ navigate }),
}))

import SettingsPage from '../pages/SettingsPage.vue'

const render = () => mount(SettingsPage, { global: { mocks: { $t: (key: string) => key } } })

const press = async (wrapper: ReturnType<typeof render>) => {
  await wrapper.find('ion-button').trigger('click')
  await flushPromises()
}

beforeEach(() => {
  connections.value = [{ baseUrl: 'https://one.example' }, { baseUrl: 'https://two.example' }]
  signOut.mockClear()
  navigate.mockClear()
})

/**
 * Signing out is the one thing this screen does while the rest of settings is
 * still to be written. A student can be signed in to more than one school, and
 * the guard that keeps a visitor out of the screens runs on a navigation — so
 * leaving either half undone leaves the app looking signed in.
 */
describe('signing out from settings', () => {
  it('gives up every school the student is signed in to, not just the first', async () => {
    await press(render())

    expect(signOut.mock.calls.map(([baseUrl]) => baseUrl)).toEqual([
      'https://one.example',
      'https://two.example',
    ])
  })

  it('sends the student to sign-in rather than leaving them on a dead screen', async () => {
    await press(render())

    expect(navigate).toHaveBeenCalledWith({ name: 'signin' }, 'root', 'replace')
  })

  it('says what is not built yet rather than showing a blank page', () => {
    expect(render().text()).toContain('settings-coming')
  })
})
