<template>
  <HelpMessage>
    {{ $t('enter-code') }}
  </HelpMessage>

  <CodeInput v-model="code" @back-button-click="onBackButtonClicked" />

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
import { ref } from 'vue'

import { clientForSignIn, startDeviceSync, useConnections, useDevice } from '@/app'
import { config as environment } from '@/config'
import { AsyncButton } from '@/design'
import type { Session } from '@/ports'
import { isUnauthorized } from '@/ports'
import { useConfig } from '@/shared'
import { CodeInput, HelpMessage } from '@/ui/auth'
import { useAuthToast } from '@/ui/auth/composables/useAuthToast'
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
const toast = useAuthToast()
const code = ref('')
const busy = ref(false)

// The session the code was traded for, kept because a code can only be traded
// once. Everything after that trade can fail on its own and be tried again —
// but not by spending the code a second time, which the server has already
// burnt.
const traded = ref<Session | undefined>(undefined)

/* -------------------------------- Handlers -------------------------------- */

// Two steps, and each says only what it knows. Telling somebody their code is
// wrong when the code was accepted and the *next* request failed makes them
// retype a correct code for as long as their patience lasts, and the thing
// that actually broke goes unmentioned.
async function onValidateCodeClicked() {
  if (busy.value) return

  busy.value = true
  try {
    const session = traded.value ?? (await tradeTheCode())
    if (session === undefined) return

    traded.value = session
    await getReady(session)
  } finally {
    busy.value = false
  }
}

function onBackButtonClicked() {
  emit('go-back')
}

/* -------------------------------- Helpers --------------------------------- */

/**
 * Trade the code for a session.
 *
 * `401` here, and only here, means the code itself was refused. Anything else
 * is the server or the network, and saying "wrong code" about it would send
 * somebody to correct six digits that were right.
 */
async function tradeTheCode(): Promise<Session | undefined> {
  try {
    return await auth.signInWithCode(client, { email: config.email.value, code: code.value })
  } catch (refusal) {
    await toast.show(isUnauthorized(refusal) ? 'wrong-code' : 'could-not-sign-in')
    return undefined
  }
}

/**
 * Everything the app needs before a screen can read anything.
 *
 * A failure here has already been preceded by a successful sign-in, so the
 * student is not being kept out — the app is not ready. It says so, and
 * pressing the button again repeats this half alone: the code is spent, and
 * asking for it again would be asking for something that cannot work.
 */
async function getReady(session: Session): Promise<void> {
  try {
    // The connection is where the session lives and what the device files its
    // rows under, so it is recorded first: it asks the server who the bearer
    // is and keeps that identity. The engine is started from here because the
    // screens behind this wizard read the device and nothing else.
    await connections.signIn({ baseUrl, session })
    await startDeviceSync(useDevice())

    // A profile exists from the first sign-in, but it has no name until the
    // student gives one, and that is what the sign-up screen asks for.
    const profile = await auth.getProfile(client)
    emit('complete', !profile.name)
  } catch {
    await toast.show('signed-in-not-ready')
  }
}
</script>
