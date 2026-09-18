import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { httpClientKey, HttpError } from '@/shared/api'
import { addMessages } from '@/shared/i18n'
import { fakeHttpClient, pending } from '@/shared/testing'

import { messages } from '../i18n'
import OtpForm from './OtpForm.vue'

addMessages(messages)

const OTP = '/auth/otp'
const SIGN_IN = '/auth/signin/otp'

/**
 * Renders the screen over the same fake transport the tests use, through the
 * same seam, so a story cannot be a version of the screen wired differently.
 */
const over = (answers: Record<string, unknown>) => () => ({
  components: { OtpForm },
  provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
  template: '<div class="max-w-[22rem] p-[--space-6]"><OtpForm /></div>',
})

const meta: Meta<typeof OtpForm> = { title: 'Auth/OtpForm', component: OtpForm }

export default meta
type Story = StoryObj<typeof OtpForm>

export const AskingForTheAddress: Story = {
  render: over({ [OTP]: { success: true }, [SIGN_IN]: {} }),
}

export const Sending: Story = {
  render: over({ [OTP]: pending() }),
}

export const CodeStillValid: Story = {
  render: over({ [OTP]: new HttpError(429, OTP, { message: 'still valid' }) }),
}

export const WrongCode: Story = {
  render: over({ [OTP]: { success: true }, [SIGN_IN]: new HttpError(401, SIGN_IN) }),
}

export const CouldNotSend: Story = {
  render: over({ [OTP]: new HttpError(500, OTP, { message: 'Mailer is down' }) }),
}
