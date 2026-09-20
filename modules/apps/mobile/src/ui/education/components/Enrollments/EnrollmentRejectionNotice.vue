<template>
  <div class="rejection">
    <SyncRejectionNotice :reason="reason" />
    <IonNote>{{ $t(explanation) }}</IonNote>
  </div>
</template>

<script setup lang="ts">
import { IonNote } from '@ionic/vue'
import { computed } from 'vue'

import { SyncRejectionNotice } from '@/ui/sync'

import type { EnrollmentRejectionNoticeProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<EnrollmentRejectionNoticeProps>()

/* --------------------------------- State ---------------------------------- */

// The two refusals ask the student for opposite things: work the school has
// already marked is settled and this phone's copy is about to be replaced,
// while every other refusal leaves their own words here, still sendable.
const explanation = computed(() =>
  props.reason === 'alreadyAccepted'
    ? 'enrollment-rejection-settled'
    : 'enrollment-rejection-retry',
)
</script>

<style scoped>
.rejection {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 16px;
}
</style>
