<template>
  <WithBorders>
    <IonInput
      v-model="typed"
      type="text"
      inputmode="numeric"
      autocomplete="one-time-code"
      :placeholder="$t('code')"
    />

    <!-- `slot` rather than a named slot of WithBorders: the borders are an
         `ion-item`, and this is how a child asks to sit at its end. -->
    <IonIcon slot="end" :icon="arrowBackOutline" aria-hidden="true" @click="onBackClicked" />
  </WithBorders>
</template>

<script lang="ts" setup>
import { IonIcon, IonInput } from '@ionic/vue'
import { arrowBackOutline } from 'ionicons/icons'
import { watch } from 'vue'

import { WithBorders } from '@/design'

import type { CodeInputEmits } from './types'

/* --------------------------------- Model ---------------------------------- */

// A code from an email is a run of digits, not a number: nothing is one more
// than a code, its leading zero is part of it, and a wheel turned over the
// field must not change it — all three of which `type="number"` would bring,
// along with the spinner arrows the browser draws for it. `one-time-code` is
// what offers the code from the message in one tap on iOS and Android.
const typed = defineModel<string>({ required: true })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<CodeInputEmits>()

/* --------------------------------- Hooks ---------------------------------- */

// The numeric keyboard is a hint and not a rule: a hardware keyboard, a paste
// and a suggestion can each put anything here, so what is not a digit is
// dropped rather than carried into the sign-in request.
watch(
  typed,
  (value) => {
    const digits = digitsOf(value)
    if (digits !== value) typed.value = digits
  },
  { immediate: true },
)

/* -------------------------------- Handlers -------------------------------- */

function onBackClicked() {
  emit('back-button-click')
}

/* -------------------------------- Helpers --------------------------------- */

function digitsOf(value: string | undefined): string {
  return (value ?? '').replace(/\D/g, '')
}
</script>

<style scoped>
ion-icon {
  opacity: 0.5;
  scale: 0.8;
}
</style>
