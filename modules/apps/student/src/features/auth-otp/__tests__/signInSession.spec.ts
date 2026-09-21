import type { HttpClient } from '@vidya/client'
import { HttpError } from '@vidya/client'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'

import { httpClientKey } from '@/shared/api'
import { useConnection } from '@/shared/connection'
import { addMessages, fluent } from '@/shared/i18n'

import { messages } from '../i18n'
import OtpForm from '../ui/OtpForm.vue'

const OTP = '/auth/otp'
const SIGN_IN = '/auth/signin/otp'
const PROFILE = '/auth/profile'

const tokens = { accessToken: 'access-token', refreshToken: 'refresh-token' }

interface Call {
  readonly method: string
  readonly path: string
  readonly body?: unknown
}

/** A transport that answers from a table and remembers what was asked. */
const fakeHttpClient = (answers: Record<string, unknown>) => {
  const calls: Call[] = []

  const answer = (call: Call) => {
    calls.push(call)
    const given = answers[call.path]
    if (given === undefined) throw new Error(`no answer for ${call.method} ${call.path}`)
    if (given instanceof Error) throw given

    return given
  }

  const client = {
    get: async (path: string) => answer({ method: 'GET', path }),
    post: async (path: string, body?: unknown) => answer({ method: 'POST', path, body }),
    patch: async (path: string, body?: unknown) => answer({ method: 'PATCH', path, body }),
    delete: async (path: string) => {
      answer({ method: 'DELETE', path })
    },
  } as unknown as HttpClient

  return { client, calls }
}

const mountForm = (answers: Record<string, unknown>) => {
  const transport = fakeHttpClient(answers)
  const form = mount(OtpForm, {
    global: {
      plugins: [fluent],
      provide: { [httpClientKey as symbol]: transport.client },
    },
  })

  return { transport, form }
}

const signIn = async (form: ReturnType<typeof mountForm>['form'], code: string) => {
  await form.find('input[name="email"]').setValue('student@example.com')
  await form.find('form').trigger('submit')
  await flushPromises()

  await form.find('input[name="one-time-code"]').setValue(code)
  await form.find('form').trigger('submit')
  await flushPromises()
}

/**
 * There is one session on this site and it is the client library's: the engine
 * reads the tokens the form writes. Two of them would mean a screen that
 * considers itself signed in while nothing is being synchronised.
 */
describe('signing in with a code', () => {
  beforeEach(() => {
    localStorage.clear()
    useConnection().signOut()
    addMessages(messages)
  })

  it('leaves the tokens where the sync engine reads them', async () => {
    const { form } = mountForm({
      [OTP]: { success: true },
      [SIGN_IN]: tokens,
      [PROFILE]: { userId: 'user-1' },
    })

    await signIn(form, '12345678')

    const { connection } = useConnection()
    expect(connection.value?.session).toEqual(tokens)
    expect(connection.value?.ownerId).toBe('user-1')
    expect(form.emitted('signed-in')).toHaveLength(1)
  })

  it('asks the server whose tokens these are, because the rows are keyed by it', async () => {
    const { transport, form } = mountForm({
      [OTP]: { success: true },
      [SIGN_IN]: tokens,
      [PROFILE]: { userId: 'user-1' },
    })

    await signIn(form, '12345678')

    expect(transport.calls.map((call) => call.path)).toEqual([OTP, SIGN_IN, PROFILE])
  })

  it('keeps the refresh token for the next visit, and not the access token', async () => {
    const { form } = mountForm({
      [OTP]: { success: true },
      [SIGN_IN]: tokens,
      [PROFILE]: { userId: 'user-1' },
    })

    await signIn(form, '12345678')

    const stored = localStorage.getItem('vidya.student.connection') ?? ''

    expect(stored).toContain('refresh-token')
    expect(stored).not.toContain('access-token')
  })

  it('starts no connection when the code is refused', async () => {
    const { form } = mountForm({
      [OTP]: { success: true },
      [SIGN_IN]: new HttpError(401, SIGN_IN),
      [PROFILE]: { userId: 'user-1' },
    })

    await signIn(form, '00000000')

    expect(useConnection().connection.value).toBeUndefined()
    expect(form.emitted('signed-in')).toBeUndefined()
    expect(form.text()).toContain('Wrong code')
  })
})
