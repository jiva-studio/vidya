<template>
  <div class="revoked">
    <IonText color="warning">
      <strong>{{ $t('sync-revoked-title') }}</strong>
    </IonText>
    <IonText>{{ $t('sync-revoked-text', { course: courseName }) }}</IonText>
    <IonNote color="success">{{ $t('sync-revoked-downloaded-stays') }}</IonNote>

    <IonButton v-if="hasDownloadedContent" expand="block" fill="outline" @click="onOpenClicked">
      {{ $t('sync-revoked-open-downloaded') }}
    </IonButton>
  </div>
</template>

<script lang="ts" setup>
import { IonButton, IonNote, IonText } from '@ionic/vue'

import type { RevokedEnrollmentNoticeEmits, RevokedEnrollmentNoticeProps } from './types'

/* --------------------------------- Props ---------------------------------- */

// Withdrawal ends the network's answer, not the device's: the course is
// explained rather than quietly removed, and what was downloaded stays open.
withDefaults(defineProps<RevokedEnrollmentNoticeProps>(), { hasDownloadedContent: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<RevokedEnrollmentNoticeEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onOpenClicked() {
  emit('open-downloaded')
}
</script>

<style scoped>
.revoked {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}
</style>
