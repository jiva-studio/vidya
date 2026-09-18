<template>
  <div class="backfill">
    <IonText>
      <strong>{{ $t('sync-backfill-title') }}</strong>
    </IonText>
    <IonNote>{{ $t('sync-backfill-text') }}</IonNote>

    <IonProgressBar :type="barType" :value="value" />
    <IonNote class="counter">{{ counter }}</IonNote>

    <slot />
  </div>
</template>

<script lang="ts" setup>
import { IonNote, IonProgressBar, IonText } from '@ionic/vue'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import type { BackfillProgressProps } from './types'

/* --------------------------------- Props ---------------------------------- */

// The first run is the one moment the device has nothing to show, so the screen
// says what is happening and how far it has got instead of standing empty. The
// slot carries whatever has already arrived.
const props = defineProps<BackfillProgressProps>()

/* --------------------------------- State ---------------------------------- */

const fluent = useFluent()

const isCounting = computed(() => props.total <= 0)
const barType = computed(() => (isCounting.value ? 'indeterminate' : 'determinate'))
const value = computed(() => (isCounting.value ? 0 : props.done / props.total))
const counter = computed(() => counterText())

/* -------------------------------- Helpers --------------------------------- */

function counterText(): string {
  if (props.total <= 0) return fluent.$t('sync-backfill-counting')

  return fluent.$t('sync-backfill-progress', { done: props.done, total: props.total })
}
</script>

<style scoped>
.backfill {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px;
}

.counter {
  font-size: 0.85em;
}
</style>
