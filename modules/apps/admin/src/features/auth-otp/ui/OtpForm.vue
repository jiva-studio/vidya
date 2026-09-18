<script setup lang="ts">
import { Button, FormField, Input } from '@vidya/ui'
import { computed, ref, watch } from 'vue'

import type { OtpFormEmits } from '../types'
import { useOtpSignIn } from '../model'
import { codeInputClasses, formClasses, linkButtonClasses, secondaryRowClasses } from './styles'

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<OtpFormEmits>()

/* --------------------------------- State ---------------------------------- */

const signIn = useOtpSignIn()
const codeField = ref<{ $el?: HTMLInputElement } | undefined>(undefined)

const showCodeStep = computed(() => signIn.step.value === 'code')
const canResend = computed(() => signIn.countdown.canResend.value)

// The error stands where the hint stands, so a refusal does not add a line and
// push everything below it down the page.
const error = computed(() => signIn.error.value)

/* ---------------------------------- Hooks --------------------------------- */

watch(showCodeStep, (shown) => {
  if (shown) codeField.value?.$el?.focus()
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
    <FormField
      :label="$t('auth-email-label')"
      :hint="$t('auth-email-hint')"
      :error="error ? $t(error) : undefined"
      required
    >
      <template #default="field">
        <Input
          :id="field.id"
          v-model="signIn.email.value"
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
    <FormField
      :label="$t('auth-code-label')"
      :hint="$t('auth-code-hint', { email: signIn.email.value })"
      :error="error ? $t(error) : undefined"
      required
    >
      <template #default="field">
        <Input
          :id="field.id"
          ref="codeField"
          v-model="signIn.code.value"
          :class="codeInputClasses"
          :aria-describedby="field.describedBy"
          :invalid="field.invalid"
          type="text"
          name="one-time-code"
          autocomplete="one-time-code"
          inputmode="numeric"
          required
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

    <div :class="secondaryRowClasses">
      <button :class="linkButtonClasses" type="button" :disabled="!canResend" @click="onResend">
        <span v-if="canResend">{{ $t('auth-code-resend') }}</span>
        <span v-else>{{ $t('auth-code-wait', { time: signIn.countdown.label.value }) }}</span>
      </button>
      <button :class="linkButtonClasses" type="button" @click="onChangeEmail">
        {{ $t('auth-code-change-email') }}
      </button>
    </div>
  </form>
</template>
