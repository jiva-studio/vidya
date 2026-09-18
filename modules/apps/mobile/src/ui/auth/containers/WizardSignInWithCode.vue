<template>
  <HelpMessage>
    {{ $t('enter-code') }}
  </HelpMessage>

  <CodeInput v-model="code" @back-button-click="onBackButtonClicked" />

  <IonNote v-if="error" color="danger">
    {{ error }}
  </IonNote>

  <AsyncButton
    :busy="busy"
    :disabled="code.length === 0"
    expand="block"
    @click="onValidateCodeClicked()"
  >
    {{ $t('sign-in') }}
  </AsyncButton>
</template>

<script lang="ts" setup>
import { IonNote } from '@ionic/vue'
import { useFluent } from 'fluent-vue'
import { ref } from 'vue'

import { useApi, useSession } from '@/app'
import { AsyncButton } from '@/design'
import { useConfig } from '@/shared'
import { CodeInput, HelpMessage } from '@/ui/auth'
import { auth } from '@/usecases'
import type { WizardSignInWithCodeEmits } from './types'

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<WizardSignInWithCodeEmits>()

/* --------------------------------- State ---------------------------------- */

const api = useApi()
const session = useSession()
const config = useConfig()
const fluent = useFluent()
const code = ref('')
const busy = ref(false)
const error = ref<string | undefined>(undefined)

/* -------------------------------- Handlers -------------------------------- */

async function onValidateCodeClicked() {
  busy.value = true
  error.value = undefined
  try {
    const started = await auth.signInWithCode(api, { email: config.email.value, code: code.value })
    await session.start(started)

    // A profile exists from the first sign-in, but it has no name until the
    // student gives one, and that is what the sign-up screen asks for.
    const profile = await auth.getProfile(api)
    emit('complete', !profile.name)
  } catch {
    error.value = fluent.$t('wrong-code')
  } finally {
    busy.value = false
  }
}

function onBackButtonClicked() {
  emit('go-back')
}
</script>
