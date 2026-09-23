<script setup lang="ts">
import { Button, FormField, Input, PinInput } from '@vidya/ui'
import { ArrowLeft } from 'lucide-vue-next'
import { computed } from 'vue'

import type { OtpFormEmits } from '../types'
import { useOtpSignIn } from '../model'
import {
  backButtonClasses,
  formClasses,
  headerClasses,
  linkButtonClasses,
  resendRowClasses,
  titleClasses,
} from './styles'

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<OtpFormEmits>()

/* --------------------------------- State ---------------------------------- */

const signIn = useOtpSignIn()

const showCodeStep = computed(() => signIn.step.value === 'code')
const canResend = computed(() => signIn.countdown.canResend.value)

// The error stands where the hint stands, so a refusal does not add a line and
// push everything below it down the page.
const error = computed(() => signIn.error.value)

/* -------------------------------- Handlers -------------------------------- */

async function onEmailSubmit() {
  await signIn.send()
}

async function onCodeSubmit() {
  const done = await signIn.submit()
  if (done) emit('signed-in')
}

function onResend() {
  void signIn.send()
}

function onChangeEmail() {
  signIn.step.value = 'email'
  signIn.code.value = ''
  signIn.error.value = undefined
}
</script>

<template>
  <div :class="headerClasses">
    <button
      v-if="showCodeStep"
      :class="backButtonClasses"
      type="button"
      :aria-label="$t('auth-code-change-email')"
      @click="onChangeEmail"
    >
      <ArrowLeft class="h-4 w-4" />
    </button>
    <h1 :class="titleClasses">{{ $t('auth-title') }}</h1>
  </div>

  <form v-if="!showCodeStep" :class="formClasses" @submit.prevent="onEmailSubmit">
    <FormField :error="error ? $t(error) : undefined">
      <template #default="field">
        <Input
          :id="field.id"
          v-model="signIn.email.value"
          :placeholder="$t('auth-email-placeholder')"
          :aria-label="$t('auth-email-label')"
          :aria-describedby="field.describedBy"
          :invalid="field.invalid"
          type="email"
          name="email"
          autocomplete="email"
          required
        />
      </template>
    </FormField>

    <Button
      type="submit"
      size="lg"
      full-width
      :busy="signIn.busy.value"
      :busy-label="$t('auth-email-sending')"
    >
      {{ $t('auth-email-submit') }}
    </Button>
  </form>

  <form v-else :class="formClasses" @submit.prevent="onCodeSubmit">
    <FormField :error="error ? $t(error) : undefined">
      <template #default="field">
        <PinInput
          :id="field.id"
          v-model="signIn.code.value"
          :length="8"
          :invalid="field.invalid"
          :aria-describedby="field.describedBy"
          type="text"
          otp
          name="one-time-code"
          @complete="onCodeSubmit"
        />
      </template>
    </FormField>

    <Button
      type="submit"
      size="lg"
      full-width
      :busy="signIn.busy.value"
      :busy-label="$t('auth-code-checking')"
    >
      {{ $t('auth-code-submit') }}
    </Button>

    <div :class="resendRowClasses">
      <button :class="linkButtonClasses" type="button" :disabled="!canResend" @click="onResend">
        <span v-if="canResend">{{ $t('auth-code-resend') }}</span>
        <span v-else>{{ $t('auth-code-wait', { time: signIn.countdown.label.value }) }}</span>
      </button>
    </div>
  </form>
</template>
