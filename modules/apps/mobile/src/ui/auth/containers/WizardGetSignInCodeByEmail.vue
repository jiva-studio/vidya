<template>
  <HelpMessage>
    {{ $t('welcome') }}
    {{ $t('enter-your-email') }}
  </HelpMessage>

  <EmailInput v-model="email" />

  <IonNote v-if="error" color="danger">
    {{ error }}
  </IonNote>

  <AsyncButton :busy="busy" :disabled="email.length === 0" @click="onSignInClicked()">
    {{ $t('request-signin-code') }}
  </AsyncButton>
</template>

<script lang="ts" setup>
import { IonNote } from '@ionic/vue'
import { useFluent } from 'fluent-vue'
import { ref } from 'vue'

import { clientForSignIn } from '@/app'
import { config as environment } from '@/config'
import { AsyncButton } from '@/design'
import { useConfig } from '@/shared'
import { EmailInput, HelpMessage } from '@/ui/auth'
import { auth } from '@/usecases'
import type { WizardGetSignInCodeByEmailEmits } from './types'

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<WizardGetSignInCodeByEmailEmits>()

/* --------------------------------- State ---------------------------------- */

const client = clientForSignIn(environment.apiBaseUrl)
const config = useConfig()
const fluent = useFluent()
const email = ref(config.email.value)
const busy = ref(false)
const error = ref<string | undefined>(undefined)

/* -------------------------------- Handlers -------------------------------- */

async function onSignInClicked() {
  busy.value = true
  error.value = undefined
  try {
    await auth.requestSignInCode(client, email.value)
    config.email.value = email.value
    emit('complete')
  } catch {
    error.value = fluent.$t('could-not-send')
  } finally {
    busy.value = false
  }
}
</script>
