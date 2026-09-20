// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { computed } from 'vue'
import { isNavigationFailure, NavigationFailureType } from 'vue-router'

/**
 * Who is let through to the screens, and who is sent to sign in.
 *
 * The rule is not "is there a session": the screens read the device, and the
 * device is keyed by the identity a connection carries. Nor is it "is the
 * token still accepted": everything already downloaded stays readable whatever
 * a server thinks of a token, and a student studying at three schools must not
 * be thrown out of the two that still work because the third went stale.
 *
 * The one case that is a dead application — every school waiting for a
 * sign-in and nothing ever downloaded — is the case this guard exists for.
 */

interface StoredConnection {
  baseUrl: string
  needsSignIn: boolean
}

const state = vi.hoisted(() => ({
  connections: [] as { baseUrl: string; needsSignIn: boolean }[],
  firstRunCompleted: false,
}))

vi.mock('@/app', () => ({
  useConnections: () => ({
    connections: computed(() => state.connections),
    awaitingSignIn: computed(() => state.connections.filter((row) => row.needsSignIn)),
  }),
  useSyncStatus: () => ({ firstRunCompleted: computed(() => state.firstRunCompleted) }),
  useRepositories: () => ({}),
  useOutboxView: () => ({}),
  useDevice: () => ({}),
  startDeviceSync: () => Promise.resolve(),
  clientForSignIn: () => ({}),
}))

const signedInTo = (needsSignIn: boolean): StoredConnection => ({
  baseUrl: 'https://school.test',
  needsSignIn,
})

// The router as the app builds it, guard and all. One is enough: the guard
// reads the registry at every navigation, so a test changes the registry
// rather than the router.
const { default: router } = await import('../router')

const reachedAfter = async (path: string): Promise<string> => {
  // From a screen the guard always allows, so the navigation under test is
  // never a no-op repeat of where the previous one ended.
  await router.replace('/auth/signin')

  // A navigation the router cancelled is one that never reached the guard —
  // it says nothing about the rule, and on a loaded machine it is what a
  // navigation still settling from the line above looks like.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const failure = await router.push(path)
    if (!isNavigationFailure(failure, NavigationFailureType.cancelled)) break
  }

  return String(router.currentRoute.value.name)
}

describe('the guard on the way to a screen', () => {
  beforeEach(() => {
    state.connections = []
    state.firstRunCompleted = false
  })

  it('sends a visitor with no connection to sign in', async () => {
    expect(await reachedAfter('/education/courses')).toBe('signin')
  })

  it('lets a working connection through', async () => {
    state.connections = [signedInTo(false)]

    expect(await reachedAfter('/education/courses')).not.toBe('signin')
  })

  it('lets a stranded connection through to what it has already downloaded', async () => {
    state.connections = [signedInTo(true)]
    state.firstRunCompleted = true

    expect(await reachedAfter('/education/courses')).not.toBe('signin')
  })

  it('keeps the schools that still work when one of them goes stale', async () => {
    state.connections = [signedInTo(true), signedInTo(false)]

    expect(await reachedAfter('/education/courses')).not.toBe('signin')
  })

  it('sends a student with nothing downloaded and no school left to sign in', async () => {
    state.connections = [signedInTo(true)]

    expect(await reachedAfter('/education/courses')).toBe('signin')
  })
})
