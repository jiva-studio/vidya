import { mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { useConnection } from '@/shared/connection'
import { fluent } from '@/shared/i18n'
import { useSiteStatus } from '@/shared/status'

import SyncState from '../ui/SyncState.vue'

const render = () => mount(SyncState, { global: { plugins: [fluent] } })

const signIn = () => {
  const connection = useConnection()
  connection.offer({ accessToken: 'access', refreshToken: 'refresh' })
  connection.signIn('user-1' as never)
}

/**
 * Offline is not promised here and there is no banner for it, but the state of
 * the data is not a secret either: a record saved and not yet sent is the
 * student's work, and this is where they can see how it stands.
 */
describe('what the settings screen says about the data', () => {
  beforeEach(() => {
    localStorage.clear()
    useConnection().signOut()

    const status = useSiteStatus()
    status.markWriting(false)
    status.markStorage('unknown')
    status.runFinished(0, false)
  })

  it('says a run is going on while one is', async () => {
    signIn()
    const status = useSiteStatus()
    status.runStarted()

    const screen = render()
    await screen.vm.$nextTick()

    expect(screen.text()).toContain('Getting your courses')
  })

  it('tells a reading tab that another one keeps the data up to date', async () => {
    useSiteStatus().markWriting(false)

    const screen = render()
    await screen.vm.$nextTick()

    expect(screen.text()).toContain('Another tab keeps the data up to date')
  })

  it('says which promise the browser gave about keeping the data', async () => {
    useSiteStatus().markStorage('temporary')

    const screen = render()
    await screen.vm.$nextTick()

    expect(screen.text()).toContain('may delete this data')
  })

  it('asks to sign in rather than reporting an empty database as a state', async () => {
    const screen = render()
    await screen.vm.$nextTick()

    expect(screen.text()).toContain('Sign in and your courses will arrive')
  })

  it('does not call the device up to date when the first run brought nothing', async () => {
    signIn()
    useSiteStatus().runFinished(0, true)

    const screen = render()
    await screen.vm.$nextTick()

    expect(screen.text()).toContain('nothing has arrived yet')
    expect(screen.text()).not.toContain('Up to date')
  })
})
