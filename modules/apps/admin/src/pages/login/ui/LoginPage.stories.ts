import type { Meta, StoryObj } from '@storybook/vue3-vite'

import { httpClientKey, HttpError } from '@/shared/api'
import type { FakeAnswers } from '@/shared/testing'
import { fakeHttpClient, pending } from '@/shared/testing'

import LoginPage from './LoginPage.vue'

/**
 * The way in, whole: the panel around the form as an operator meets it.
 *
 * There is nothing to be without rights for, and nothing to be empty of, so
 * this screen has the three states it can be in.
 */
const OTP = '/auth/otp'
const SIGN_IN = '/auth/signin/otp'

const over = (answers: FakeAnswers) => () => ({
  components: { LoginPage },
  provide: { [httpClientKey as symbol]: fakeHttpClient(answers).client },
  template: '<LoginPage />',
})

const meta: Meta<typeof LoginPage> = { title: 'Auth/Login', component: LoginPage }

export default meta
type Story = StoryObj<typeof LoginPage>

export const WithData: Story = {
  name: 'Данные',
  render: over({ [OTP]: { success: true }, [SIGN_IN]: {} }),
}

export const Loading: Story = { name: 'Загрузка', render: over({ [OTP]: pending() }) }

export const Failed: Story = {
  name: 'Ошибка',
  render: over({ [OTP]: new HttpError(500, OTP, { message: 'Почта сейчас не отправляется' }) }),
}
