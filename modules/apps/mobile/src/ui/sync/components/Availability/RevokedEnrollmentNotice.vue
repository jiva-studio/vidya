<template>
  <div class="revoked">
    <IonText color="warning">
      <strong>{{ $t(copy.title) }}</strong>
    </IonText>
    <IonText>{{ $t(copy.text, { course: courseName }) }}</IonText>
    <IonNote color="success">{{ $t('sync-revoked-downloaded-stays') }}</IonNote>

    <IonButton v-if="hasDownloadedContent" expand="block" fill="outline" @click="onOpenClicked">
      {{ $t('sync-revoked-open-downloaded') }}
    </IonButton>
  </div>
</template>

<script lang="ts" setup>
import { IonButton, IonNote, IonText } from '@ionic/vue'
import { computed } from 'vue'

import type {
  EnrollmentEnding,
  RevokedEnrollmentNoticeEmits,
  RevokedEnrollmentNoticeProps,
} from './types'

/* --------------------------------- Props ---------------------------------- */

// Withdrawal ends the network's answer, not the device's: the course is
// explained rather than quietly removed, and what was downloaded stays open.
const props = withDefaults(defineProps<RevokedEnrollmentNoticeProps>(), {
  hasDownloadedContent: false,
  reason: 'revoked',
})

/* --------------------------------- State ---------------------------------- */

// Everything but one sentence is the same either way, and that sentence is the
// one that must not tell a student the school ended what they ended themselves.
const COPY: Readonly<Record<EnrollmentEnding, { title: string; text: string }>> = Object.freeze({
  revoked: { title: 'sync-revoked-title', text: 'sync-revoked-text' },
  withdrawn: { title: 'sync-withdrawn-title', text: 'sync-withdrawn-text' },
})

const copy = computed(() => COPY[props.reason])

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
