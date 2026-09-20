<template>
  <div class="sign-in-again">
    <IonText color="warning">
      <strong>{{ $t('sync-sign-in-again-title') }}</strong>
    </IonText>
    <IonText>{{ $t('sync-sign-in-again-text', { schools }) }}</IonText>
    <IonNote color="success">{{ $t('sync-sign-in-again-downloaded-stays') }}</IonNote>

    <IonButton expand="block" fill="outline" @click="onSignInClicked">
      {{ $t('sync-sign-in-again-action') }}
    </IonButton>
  </div>
</template>

<script lang="ts" setup>
import { IonButton, IonNote, IonText } from '@ionic/vue'

import type { SignInAgainNoticeEmits, SignInAgainNoticeProps } from './types'

/* --------------------------------- Props ---------------------------------- */

// A refused renewal belongs to one school, not to the app: the others go on
// syncing, and everything already on the device goes on reading. The notice
// therefore sits in the page's flow above the list it affects rather than over
// the whole screen, and says how many schools it is talking about.
defineProps<SignInAgainNoticeProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SignInAgainNoticeEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onSignInClicked() {
  emit('sign-in')
}
</script>

<style scoped>
.sign-in-again {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}
</style>
