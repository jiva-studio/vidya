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

import { clientForSignIn, startDeviceSync, useConnections, useDevice } from '@/app'
import { config as environment } from '@/config'
import { AsyncButton } from '@/design'
import { useConfig } from '@/shared'
import { CodeInput, HelpMessage } from '@/ui/auth'
import { auth } from '@/usecases'
import type { WizardSignInWithCodeEmits } from './types'

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<WizardSignInWithCodeEmits>()

/* --------------------------------- State ---------------------------------- */

// The server this build signs in to by default. Which server a student joins
// is the screen's business, and the next school they add will be at another.
const baseUrl = environment.apiBaseUrl
const client = clientForSignIn(baseUrl)
const connections = useConnections()
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
    const started = await auth.signInWithCode(client, {
      email: config.email.value,
      code: code.value,
    })

    // The connection is where the session lives and what the device files its
    // rows under, so it is recorded first: it asks the server who the bearer
    // is and keeps that identity. The engine is started from here because the
    // screens behind this wizard read the device and nothing else.
    await connections.signIn({ baseUrl, session: started })
    await startDeviceSync(useDevice())

    // A profile exists from the first sign-in, but it has no name until the
    // student gives one, and that is what the sign-up screen asks for.
    const profile = await auth.getProfile(client)
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
