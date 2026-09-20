// @vitest-environment jsdom
import { toastController } from '@ionic/vue'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { HttpError } from '@/ports'

const server = vi.hoisted(() => ({
  /** What `POST /auth/signin/otp` does. */
  signIn: null as unknown,

  /** What `GET /auth/profile` does. */
  profile: null as unknown,

  /** What recording the connection does. */
  connect: null as unknown,

  posts: 0,
}))

vi.mock('@/app', () => ({
  clientForSignIn: () => ({
    post: async () => {
      server.posts += 1
      if (server.signIn !== null) throw server.signIn
      return { accessToken: 'access', refreshToken: 'refresh' }
    },
    get: async () => {
      if (server.profile !== null) throw server.profile
      return { userId: 'e0e2f2c2-0000-4000-8000-000000000001', name: 'Rupa' }
    },
  }),
  useConnections: () => ({
    signIn: async () => {
      if (server.connect !== null) throw server.connect
    },
  }),
  startDeviceSync: async () => undefined,
  useDevice: () => ({}),
}))

import { AsyncButton } from '@/design'

import CodeInput from '../components/CodeInput.vue'
import WizardSignInWithCode from '../containers/WizardSignInWithCode.vue'
import { fluentFor } from './fluentFor'

const said: string[] = []

const render = () => mount(WizardSignInWithCode, { global: { plugins: [fluentFor()] } })

async function enterCode(wrapper: VueWrapper): Promise<void> {
  wrapper.findComponent(CodeInput).vm.$emit('update:modelValue', '771132')
  await wrapper.vm.$nextTick()
  wrapper.findComponent(AsyncButton).vm.$emit('click')

  for (let turn = 0; turn < 5; turn += 1) await new Promise((done) => setTimeout(done, 0))
}

beforeEach(() => {
  said.length = 0
  server.signIn = null
  server.profile = null
  server.connect = null
  server.posts = 0

  vi.spyOn(toastController, 'create').mockImplementation(async (options) => {
    said.push(String(options.message))
    return { present: async () => undefined } as never
  })
})

afterEach(() => vi.restoreAllMocks())

/**
 * Signing in is two things, and only the first one is about the code.
 *
 * The server takes the code and answers with tokens; after that the app
 * records the connection, starts the engine and reads the profile. A failure
 * in the second half reported as "that code did not work" sends somebody to
 * retype six digits that were right — and the code is spent by then, so every
 * attempt after the first is refused for real. The screen would be lying and
 * then proving its own lie.
 */
describe('handing in the code', () => {
  it('says the code did not work when the server refuses the code', async () => {
    server.signIn = new HttpError(401, '/auth/signin/otp')

    const wrapper = render()
    await enterCode(wrapper)

    expect(said).toEqual(['That code did not work. Check it and try again.'])
    expect(wrapper.emitted('complete')).toBeUndefined()
  })

  it('does not blame the code when the server itself breaks', async () => {
    server.signIn = new HttpError(500, '/auth/signin/otp')

    await enterCode(render())

    expect(said[0]).not.toContain('That code did not work')
    expect(said).toEqual(['You could not be signed in. Check your connection and try again.'])
  })

  it('does not blame the code when the profile the app reads afterwards is missing', async () => {
    // The refusal that cost an afternoon: sign-in answers 201, the profile
    // answers 404, and the screen used to call that a wrong code.
    server.profile = new HttpError(404, '/auth/profile')

    const wrapper = render()
    await enterCode(wrapper)

    expect(said[0]).not.toContain('That code did not work')
    expect(said[0]).toContain('signed in')
    expect(wrapper.emitted('complete')).toBeUndefined()
  })

  it('does not blame the code when the connection cannot be recorded', async () => {
    server.connect = new HttpError(404, '/auth/profile')

    await enterCode(render())

    expect(said[0]).not.toContain('That code did not work')
    expect(said[0]).toContain('signed in')
  })

  it('never asks the server for the code twice, because it is spent', async () => {
    server.profile = new HttpError(404, '/auth/profile')

    const wrapper = render()
    await enterCode(wrapper)
    await enterCode(wrapper)

    expect(server.posts).toBe(1)
  })

  it('carries on from where it stopped once what broke is mended', async () => {
    server.profile = new HttpError(404, '/auth/profile')

    const wrapper = render()
    await enterCode(wrapper)

    server.profile = null
    await enterCode(wrapper)

    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('says nothing and moves on when everything works', async () => {
    const wrapper = render()
    await enterCode(wrapper)

    expect(said).toEqual([])
    expect(wrapper.emitted('complete')).toEqual([[false]])
  })
})
