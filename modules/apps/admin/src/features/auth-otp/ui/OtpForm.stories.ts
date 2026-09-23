import type { Meta, StoryObj } from '@storybook/vue3-vite'
import { userEvent, within } from 'storybook/test'

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
  template: '<div class="max-w-[22rem] p-[var(--space-6)]"><OtpForm /></div>',
})

const meta: Meta<typeof OtpForm> = { title: 'Admin/Sign in/Code', component: OtpForm }

export default meta
type Story = StoryObj<typeof OtpForm>

/**
 * Every state past the first one is reached by using the form, so a story that
 * only wires the transport shows the first screen five times. These ask for the
 * code the way a person does.
 */
const askForCode = async (canvasElement: HTMLElement) => {
  const form = within(canvasElement)
  await userEvent.type(form.getByLabelText(/почта|mail/i), 'anna@example.com')
  await userEvent.click(form.getByRole('button', { name: /код|code/i }))
}

const enterCode = async (canvasElement: HTMLElement) => {
  await askForCode(canvasElement)
  const form = within(canvasElement)
  const firstSlot = (await form.findAllByRole('textbox'))[0]
  if (firstSlot) await userEvent.type(firstSlot, '12345678')
  await userEvent.click(form.getByRole('button', { name: /войти|sign in/i }))
}

export const Default: Story = {
  render: over({ [OTP]: { success: true }, [SIGN_IN]: {} }),
}

export const Loading: Story = {
  render: over({ [OTP]: pending() }),
  play: ({ canvasElement }) => askForCode(canvasElement),
}

export const Failed: Story = {
  render: over({ [OTP]: new HttpError(500, OTP, { message: 'Mailer is down' }) }),
  play: ({ canvasElement }) => askForCode(canvasElement),
}
export const WaitingForTheCode: Story = {
  render: over({ [OTP]: { success: true }, [SIGN_IN]: {} }),
  play: ({ canvasElement }) => askForCode(canvasElement),
}

export const CodeStillValid: Story = {
  render: over({ [OTP]: new HttpError(429, OTP, { message: 'still valid' }) }),
  play: ({ canvasElement }) => askForCode(canvasElement),
}

export const WrongCode: Story = {
  render: over({ [OTP]: { success: true }, [SIGN_IN]: new HttpError(401, SIGN_IN) }),
  play: ({ canvasElement }) => enterCode(canvasElement),
}
