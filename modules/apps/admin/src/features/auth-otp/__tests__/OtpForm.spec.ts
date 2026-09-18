import { flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { httpClientKey, HttpError, resetApi } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
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

  it('offers one field that takes a pasted code, not six boxes', async () => {
    const { form } = mountForm({ [OTP]: { success: true } })
    await typeEmail(form, 'owner@example.com')

    const field = form.find('input[name="one-time-code"]')

    expect(form.findAll('input[name="one-time-code"]')).toHaveLength(1)
    expect(field.attributes('autocomplete')).toBe('one-time-code')
    expect(field.attributes('inputmode')).toBe('numeric')

    await field.setValue('123456')
    expect((field.element as HTMLInputElement).value).toBe('123456')
  })

  it('treats a 429 as a code already in the inbox, not as a failure', async () => {
    const { form } = mountForm({
      [OTP]: new HttpError(429, OTP, { message: 'An OTP has already been generated' }),
    })

    await typeEmail(form, 'owner@example.com')

    expect(form.find('input[name="one-time-code"]').exists()).toBe(true)
    expect(form.text()).toContain('Код уже отправлен и ещё действует')
  })

  it('counts down instead of offering a button that answers 429', async () => {
    const { form } = mountForm({ [OTP]: { success: true } })
    await typeEmail(form, 'owner@example.com')

    const resend = form.findAll('button[type="button"]')[0]

    expect(resend.attributes('disabled')).toBeDefined()
    expect(resend.text()).toMatch(/\d:\d{2}/)
  })

  it('lets the code be asked for again once the countdown runs out', async () => {
    vi.useFakeTimers()
    const { form } = mountForm({ [OTP]: { success: true } })

    await form.find('input[name="email"]').setValue('owner@example.com')
    await form.find('form').trigger('submit')
    await flushPromises()

    vi.advanceTimersByTime(300_000)
    await flushPromises()

    expect(form.findAll('button[type="button"]')[0].attributes('disabled')).toBeUndefined()
  })

  it('keeps what was typed when the code is wrong, and says why', async () => {
    const { form } = mountForm({
      [OTP]: { success: true },
      [SIGN_IN]: new HttpError(401, SIGN_IN),
    })
    await typeEmail(form, 'owner@example.com')

    await form.find('input[name="one-time-code"]').setValue('000000')
    await form.find('form').trigger('submit')
    await flushPromises()

    expect(form.text()).toContain('Код неверный')
    expect((form.find('input[name="one-time-code"]').element as HTMLInputElement).value).toBe(
      '000000',
    )
    expect(form.find('input[name="one-time-code"]').exists()).toBe(true)
  })

  it('starts the session and says so when the code is right', async () => {
    const { form } = mountForm({ [OTP]: { success: true }, [SIGN_IN]: tokens })
    await typeEmail(form, 'owner@example.com')

    await form.find('input[name="one-time-code"]').setValue('123456')
    await form.find('form').trigger('submit')
    await flushPromises()

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
