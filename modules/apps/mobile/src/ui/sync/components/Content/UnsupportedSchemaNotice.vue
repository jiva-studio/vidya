<template>
  <div class="notice" :data-content-schema="contentSchemaVersion">
    <IonText color="primary">
      <strong>{{ $t('sync-outdated-app-title') }}</strong>
    </IonText>
    <IonText>{{ $t('sync-outdated-app-text') }}</IonText>

    <IonButton expand="block" @click="onUpdateClicked">
      {{ $t('sync-outdated-app-update') }}
    </IonButton>
  </div>
</template>

<script lang="ts" setup>
import { IonButton, IonText } from '@ionic/vue'

import type { UnsupportedSchemaNoticeEmits, UnsupportedSchemaNoticeProps } from './types'

/* --------------------------------- Props ---------------------------------- */

// The versions are shown to nobody but are carried as attributes so a support
// conversation has something to quote.
defineProps<UnsupportedSchemaNoticeProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<UnsupportedSchemaNoticeEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onUpdateClicked() {
  emit('update-app')
}
</script>

<style scoped>
.notice {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}
</style>
