import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { httpClientKey, HttpError, resetApi } from '@/shared/api'
import { addMessages, translate } from '@/shared/i18n'
import { useSession } from '@/shared/session'
import { fakeHttpClient, mountWithApp } from '@/shared/testing'

import { messages } from '../i18n'
import OtpForm from '../ui/OtpForm.vue'

const OTP = '/auth/otp'
const SIGN_IN = '/auth/signin/otp'

const tokens = {
  accessToken: `header.${btoa(JSON.stringify({ sub: 'u1', exp: 2_000_000_000, permissions: [] }))}.sig`,
  refreshToken: 'refresh-token',
}

const mountForm = (answers: Record<string, unknown>) => {
  const transport = fakeHttpClient(answers)
  const form = mountWithApp(OtpForm, {
    global: { provide: { [httpClientKey as symbol]: transport.client } },
  })
  return { transport, form }
}

const typeEmail = async (form: ReturnType<typeof mountWithApp>, value: string) => {
  await form.find('input[name="email"]').setValue(value)
  await form.find('form').trigger('submit')
  await flushPromises()
}

const typeCode = async (form: ReturnType<typeof mountWithApp>, value: string) => {
  const inputs = form.findAll('input[aria-label*="pin input"]')
  for (let i = 0; i < value.length && i < inputs.length; i++) {
    await inputs[i].setValue(value[i])
  }
  await flushPromises()
}

describe('OtpForm', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
    localStorage.clear()
    resetApi()
    useSession().end()
    addMessages(messages)
  })

  it('asks for the code once the address has been sent', async () => {
    const { transport, form } = mountForm({ [OTP]: { success: true } })

    await typeEmail(form, 'owner@example.com')

    expect(transport.calls).toEqual([
      { method: 'POST', path: OTP, body: { type: 'email', destination: 'owner@example.com' } },
    ])
    expect(form.find('input[name="one-time-code"]').exists()).toBe(true)
  })

  it('offers eight digit boxes that accept the code', async () => {
    const { form } = mountForm({ [OTP]: { success: true } })
    await typeEmail(form, 'owner@example.com')

    const hidden = form.find('input[name="one-time-code"]')
    expect(hidden.exists()).toBe(true)

    const inputs = form.findAll('input[aria-label*="pin input"]')
    expect(inputs).toHaveLength(8)
  })

  it('lets the user go back to change the email using the back button in header', async () => {
    const { form } = mountForm({ [OTP]: { success: true } })
    await typeEmail(form, 'owner@example.com')

    expect(form.find('input[name="one-time-code"]').exists()).toBe(true)

    const backButton = form.find(
      'button[aria-label="Ввести другой адрес"], button[aria-label="Use a different address"]',
    )
    expect(backButton.exists()).toBe(true)
    await backButton.trigger('click')
    await flushPromises()

    expect(form.find('input[name="email"]').exists()).toBe(true)
    expect(form.find('input[name="one-time-code"]').exists()).toBe(false)
  })

  it('treats a 429 as a code already in the inbox, not as a failure', async () => {
    const { form } = mountForm({
      [OTP]: new HttpError(429, OTP, { message: 'An OTP has already been generated' }),
    })

    await typeEmail(form, 'owner@example.com')

    expect(form.find('input[name="one-time-code"]').exists()).toBe(true)
    expect(form.find('[role="alert"]').exists()).toBe(false)
  })

  it('counts down instead of offering a button that answers 429', async () => {
    const { form } = mountForm({ [OTP]: { success: true } })
    await typeEmail(form, 'owner@example.com')

    const resend = form.findAll('button[type="button"]').find((b) => b.text().match(/\d:\d{2}/))
    expect(resend).toBeDefined()
    expect(resend!.attributes('disabled')).toBeDefined()
  })

  it('lets the code be asked for again once the countdown runs out', async () => {
    vi.useFakeTimers()
    const { form } = mountForm({ [OTP]: { success: true } })

    await form.find('input[name="email"]').setValue('owner@example.com')
    await form.find('form').trigger('submit')
    await flushPromises()

    vi.advanceTimersByTime(300_000)
    await flushPromises()

    const resend = form
      .findAll('button[type="button"]')
      .find((b) => b.text().includes(translate('auth-code-resend')))
    expect(resend).toBeDefined()
    expect(resend!.attributes('disabled')).toBeUndefined()
  })

  it('keeps what was typed when the code is wrong, and says why', async () => {
    const { form } = mountForm({
      [OTP]: { success: true },
      [SIGN_IN]: new HttpError(401, SIGN_IN),
    })
    await typeEmail(form, 'owner@example.com')

    await typeCode(form, '00000000')

    expect(form.text()).toContain(translate('auth-error-wrong-code'))
    expect(form.find('input[name="one-time-code"]').exists()).toBe(true)
  })

  it('starts the session and says so when the code is right', async () => {
    const { form } = mountForm({ [OTP]: { success: true }, [SIGN_IN]: tokens })
    await typeEmail(form, 'owner@example.com')

    await typeCode(form, '12345678')

    expect(useSession().isSignedIn.value).toBe(true)
    expect(form.emitted('signed-in')).toHaveLength(1)
  })

  it('shows the server reason when the address is refused', async () => {
    const { form } = mountForm({
      [OTP]: new HttpError(501, OTP, { message: 'Cannot send an OTP over sms yet' }),
    })

    await typeEmail(form, 'owner@example.com')

    expect(form.text()).toContain('Cannot send an OTP over sms yet')
    expect(form.find('input[name="one-time-code"]').exists()).toBe(false)
  })

  it('sends nothing when the address is blank', async () => {
    const { transport, form } = mountForm({ [OTP]: { success: true } })

    await form.find('form').trigger('submit')
    await flushPromises()

    expect(transport.calls).toHaveLength(0)
  })
})
