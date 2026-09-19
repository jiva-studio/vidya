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

import { startDeviceSync, useConnections, useDevice, useSession } from '@/app'
import { AsyncButton } from '@/design'
import { useConfig } from '@/shared'
import { CodeInput, HelpMessage } from '@/ui/auth'
import { useAuthClient } from '@/ui/auth/composables/useAuthClient'
import { auth } from '@/usecases'
import type { WizardSignInWithCodeEmits } from './types'

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<WizardSignInWithCodeEmits>()

/* --------------------------------- State ---------------------------------- */

const { baseUrl, client } = useAuthClient()
const session = useSession()
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
    await session.start(started)

    // The connection is what the device files its rows under, so it is
    // recorded before anything is read: it asks the server who the bearer is
    // and keeps that identity. The engine is started from here because the
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
