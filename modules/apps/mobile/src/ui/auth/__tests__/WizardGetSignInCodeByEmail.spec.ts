// @vitest-environment jsdom
import { toastController } from '@ionic/vue'
import { HttpError } from '@vidya/client'
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const refusal = vi.hoisted(() => ({ thrown: null as unknown }))

vi.mock('@/app', () => ({
  clientForSignIn: () => ({
    post: async () => {
      if (refusal.thrown !== null) throw refusal.thrown
      return { success: true }
    },
  }),
}))

import { AsyncButton } from '@/design'

import EmailInput from '../components/EmailInput.vue'
import WizardGetSignInCodeByEmail from '../containers/WizardGetSignInCodeByEmail.vue'
import { fluentFor } from './fluentFor'

const presented: { message?: string; color?: string; position?: string }[] = []

const render = () => mount(WizardGetSignInCodeByEmail, { global: { plugins: [fluentFor()] } })

async function askForCode(wrapper: VueWrapper): Promise<void> {
  wrapper.findComponent(EmailInput).vm.$emit('update:modelValue', 'student@example.org')
  await wrapper.vm.$nextTick()
  wrapper.findComponent(AsyncButton).vm.$emit('click')

  for (let turn = 0; turn < 5; turn += 1) await new Promise((done) => setTimeout(done, 0))
}

beforeEach(() => {
  presented.length = 0
  refusal.thrown = null

  vi.spyOn(toastController, 'create').mockImplementation(async (options) => {
    presented.push(options as (typeof presented)[number])
    return { present: async () => undefined } as never
  })
})

afterEach(() => vi.restoreAllMocks())

/**
 * What the screen says when a code was asked for and did not come back.
 *
 * The one answer that is not a failure is the server keeping the previous code
 * alive: it means the email is already sitting in the mailbox. Saying "check
 * your connection" then is false twice over — it blames a connection that
 * works, and it hides the code the person already has.
 */
describe('asking for a sign-in code', () => {
  it('says the code is waiting when the server keeps the last one alive', async () => {
    refusal.thrown = new HttpError(429, '/auth/otp')

    await askForCode(render())

    expect(presented[0]?.message).toBe('The code is already in your inbox. Check your email.')
  })

  it('does not tell that person to go and check their connection', async () => {
    refusal.thrown = new HttpError(429, '/auth/otp')

    await askForCode(render())

    expect(presented[0]?.message).not.toContain('connection')
    expect(presented[0]?.color).not.toBe('danger')
  })

  it('goes on to the box the waiting code is typed into', async () => {
    refusal.thrown = new HttpError(429, '/auth/otp')

    const wrapper = render()
    await askForCode(wrapper)

    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('calls a real refusal a failure, and stays where it is', async () => {
    refusal.thrown = new HttpError(500, '/auth/otp')

    const wrapper = render()
    await askForCode(wrapper)

    expect(presented[0]?.message).toBe(
      'The code could not be sent. Check the address and your connection.',
    )
    expect(presented[0]?.color).toBe('danger')
    expect(wrapper.emitted('complete')).toBeUndefined()
  })

  it('says nothing at all when the code goes out', async () => {
    const wrapper = render()
    await askForCode(wrapper)

    expect(presented).toEqual([])
    expect(wrapper.emitted('complete')).toHaveLength(1)
  })

  it('keeps the message clear of the button that was just pressed', async () => {
    refusal.thrown = new HttpError(500, '/auth/otp')

    await askForCode(render())

    expect(presented[0]?.position).toBe('top')
  })
})
