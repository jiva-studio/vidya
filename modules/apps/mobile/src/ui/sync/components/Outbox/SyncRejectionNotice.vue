<template>
  <div class="notice" :data-reason="reason">
    <IonText color="warning">
      <strong>{{ $t('sync-rejection-title') }}</strong>
    </IonText>
    <IonText>{{ explanation }}</IonText>
    <IonNote color="success">{{ $t('sync-rejection-kept-on-device') }}</IonNote>
  </div>
</template>

<script lang="ts" setup>
import { IonNote, IonText } from '@ionic/vue'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import type { SyncRejectionNoticeProps } from './types'

/* --------------------------------- Props ---------------------------------- */

// A refusal is the state of the row, never a pop-up: it stays next to the work
// it belongs to, and the work itself stays on the device.
const props = defineProps<SyncRejectionNoticeProps>()

/* --------------------------------- State ---------------------------------- */

const fluent = useFluent()

const explanation = computed(() => fluent.$t(`sync-rejection-${props.reason}`))
</script>

<style scoped>
.notice {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0;
}
</style>
