<template>
  <div class="rejection">
    <SyncRejectionNotice :reason="reason" />
    <IonNote>{{ $t(explanation) }}</IonNote>
  </div>
</template>

<script setup lang="ts">
import { IonNote } from '@ionic/vue'
import { DeviceRejectionReasons } from '@vidya/domain'
import { computed } from 'vue'

import { SyncRejectionNotice } from '@/ui/sync'

import type { EnrollmentRejectionNoticeProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<EnrollmentRejectionNoticeProps>()

/* --------------------------------- State ---------------------------------- */

const decidedHere = new Set<string>(DeviceRejectionReasons)

// The three refusals ask the student for different things. A refusal the
// device settled never reached the school and never will, because the access
// it needed is gone. Work the school has already marked is settled, and this
// phone's copy is about to be replaced by theirs. Every other refusal leaves
// the student's own words here, still sendable.
const explanation = computed(() => {
  if (decidedHere.has(props.reason)) return 'enrollment-rejection-access-lost'

  return props.reason === 'alreadyAccepted'
    ? 'enrollment-rejection-settled'
    : 'enrollment-rejection-retry'
})
</script>

<style scoped>
.rejection {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 0 16px;
}
</style>
