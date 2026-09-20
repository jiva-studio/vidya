<template>
  <HelpMessage>
    {{ $t('welcome') }}
    {{ $t('enter-your-email') }}
  </HelpMessage>

  <EmailInput v-model="email" />

  <AsyncButton :busy="busy" :disabled="email.length === 0" @click="onSignInClicked()">
    {{ $t('request-signin-code') }}
  </AsyncButton>
</template>

<script lang="ts" setup>
import { ref } from 'vue'

import { clientForSignIn } from '@/app'
import { config as environment } from '@/config'
import { AsyncButton } from '@/design'
import { useConfig } from '@/shared'
import { EmailInput, HelpMessage } from '@/ui/auth'
import { useAuthToast } from '@/ui/auth/composables/useAuthToast'
import type { CodeRequestOutcome } from '@/ui/auth/model/codeRequest'
import { outcomeOfCodeRequest } from '@/ui/auth/model/codeRequest'
import { auth } from '@/usecases'

import type { WizardGetSignInCodeByEmailEmits } from './types'

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<WizardGetSignInCodeByEmailEmits>()

/* --------------------------------- State ---------------------------------- */

const client = clientForSignIn(environment.apiBaseUrl)
const config = useConfig()
const toast = useAuthToast()
const email = ref(config.email.value)
const busy = ref(false)

/* -------------------------------- Handlers -------------------------------- */

// A code the server would not mint because the last one is still alive is not
// a reason to stay here: that code is in the mailbox, so the wizard goes on to
// the box it is typed into, and the toast says where to look for it.
async function onSignInClicked() {
  if (busy.value) return

  busy.value = true
  try {
    const outcome = await askForCode()
    const carryOn = outcome === null || outcome.codeIsWaiting

    if (outcome !== null) await toast.show(outcome.message, outcome.tone)
    if (!carryOn) return

    config.email.value = email.value
    emit('complete')
  } finally {
    busy.value = false
  }
}

/* -------------------------------- Helpers --------------------------------- */

/**
 * Ask the server for a code. Answers `null` when one went out, and otherwise
 * what to say about the refusal.
 *
 * Only this call is guarded: what follows it — remembering the address and
 * moving to the next step — cannot fail, and a `catch` stretched over it would
 * report those as a code that could not be sent.
 */
async function askForCode(): Promise<CodeRequestOutcome | null> {
  try {
    await auth.requestSignInCode(client, email.value)
    return null
  } catch (refusal) {
    return outcomeOfCodeRequest(refusal)
  }
}
</script>
