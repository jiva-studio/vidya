<script setup lang="ts">
import { computed, ref, watch } from 'vue'

import type { OtpFormEmits } from '../types'
import { useOtpSignIn } from '../model'
import {
  codeInputClasses,
  errorClasses,
  formClasses,
  hintClasses,
  inputClasses,
  labelClasses,
  linkButtonClasses,
  primaryButtonClasses,
} from './styles'

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<OtpFormEmits>()

/* --------------------------------- State ---------------------------------- */

const signIn = useOtpSignIn()
const codeField = ref<HTMLInputElement | undefined>(undefined)

const showCodeStep = computed(() => signIn.step.value === 'code')
const canResend = computed(() => signIn.countdown.canResend.value)

/* ---------------------------------- Hooks --------------------------------- */

watch(showCodeStep, (shown) => {
  if (shown) codeField.value?.focus()
})

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
}
</script>

<template>
  <form v-if="!showCodeStep" :class="formClasses" @submit.prevent="onEmailSubmit">
    <label :class="labelClasses" for="otp-email">{{ $t('auth-email-label') }}</label>
    <input
      id="otp-email"
      v-model="signIn.email.value"
      :class="inputClasses"
      type="email"
      name="email"
      autocomplete="email"
      required
    />
    <p :class="hintClasses">{{ $t('auth-email-hint') }}</p>
    <p v-if="signIn.error.value" :class="errorClasses" role="alert">
      {{ $t(signIn.error.value) }}
    </p>
    <button :class="primaryButtonClasses" type="submit" :disabled="signIn.busy.value">
      {{ $t('auth-email-submit') }}
    </button>
  </form>

  <form v-else :class="formClasses" @submit.prevent="onCodeSubmit">
    <label :class="labelClasses" for="otp-code">{{ $t('auth-code-label') }}</label>
    <input
      id="otp-code"
      ref="codeField"
      v-model="signIn.code.value"
      :class="codeInputClasses"
      type="text"
      name="one-time-code"
      autocomplete="one-time-code"
      inputmode="numeric"
      required
    />
    <p :class="hintClasses">{{ $t('auth-code-hint', { email: signIn.email.value }) }}</p>
    <p v-if="signIn.error.value" :class="errorClasses" role="alert">
      {{ $t(signIn.error.value) }}
    </p>
    <button :class="primaryButtonClasses" type="submit" :disabled="signIn.busy.value">
      {{ $t('auth-code-submit') }}
    </button>
    <button :class="linkButtonClasses" type="button" :disabled="!canResend" @click="onResend">
      <span v-if="canResend">{{ $t('auth-code-resend') }}</span>
      <span v-else>{{ $t('auth-code-wait', { time: signIn.countdown.label.value }) }}</span>
    </button>
    <button :class="linkButtonClasses" type="button" @click="onChangeEmail">
      {{ $t('auth-code-change-email') }}
    </button>
  </form>
</template>
