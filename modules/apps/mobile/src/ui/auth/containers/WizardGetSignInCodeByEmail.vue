<template>
  <HelpMessage>
    {{ $t('welcome') }}
    {{ $t('enter-your-email') }}
  </HelpMessage>

  <EmailInput v-model="email" />

  <IonNote
    v-if="error"
    color="danger"
  >
    {{ error }}
  </IonNote>

  <AsyncButton
    :busy="busy"
    :disabled="email.length === 0"
    @click="onSignInClicked()"
  >
    {{ $t('request-signin-code') }}
  </AsyncButton>
</template>

<script lang="ts" setup>
import { IonNote } from '@ionic/vue'
import { useFluent } from 'fluent-vue'
import { ref } from 'vue'

import { useApi } from '@/app'
import { AsyncButton } from '@/design'
import { useConfig } from '@/shared'
import { EmailInput, HelpMessage } from '@/ui/auth'
import { auth } from '@/usecases'

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<{ complete: [] }>()

/* --------------------------------- State ---------------------------------- */

const api = useApi()
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
    await auth.requestSignInCode(api, email.value)
    config.email.value = email.value
    emit('complete')
  } catch {
    error.value = fluent.$t('could-not-send')
  } finally {
    busy.value = false
  }
}
</script>

<fluent locale="en">
welcome = Welcome to the School of Devotion!
enter-your-email = Enter your email and we will send you a code to log in.
request-signin-code = Request Code
could-not-send = The code could not be sent. Check the address and your connection.
</fluent>

<fluent locale="ru">
welcome = Добро пожаловать в Школу Преданности!
enter-your-email = Введите почту, и мы пришлём код для входа.
request-signin-code = Получить код
could-not-send = Код не отправился. Проверьте адрес и соединение.
</fluent>
