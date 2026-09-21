<script setup lang="ts">
import { AlertDialog, Button } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import { mutedClasses } from '@/shared/ui'

import { useLeaveSchool } from '../model'
import type { LeaveSchoolPanelProps, LeaveStage } from '../types'
import { schoolRowClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<LeaveSchoolPanelProps>()

/* --------------------------------- State ---------------------------------- */

const fluent = useFluent()
const { stage, leave } = useLeaveSchool()
const asking = ref(false)

// What it costs is counted here, from the places this machine holds, because
// the server's own count arrives with the answer — by which time the places
// are already gone and a question about them is no longer a question.
const cost = computed(() =>
  props.places > 0 ? fluent.$t('leave-cost', { places: props.places }) : fluent.$t('leave-free'),
)

const notice = computed(() => NOTICES[stage.value])

/* -------------------------------- Handlers -------------------------------- */

function onLeaveClicked() {
  asking.value = true
}

async function onConfirmed() {
  asking.value = false
  await leave(props.school.id)
}

/* -------------------------------- Helpers --------------------------------- */

const NOTICES: Record<LeaveStage, string | undefined> = {
  idle: undefined,
  leaving: 'leave-leaving',
  left: 'leave-left',
  owner: 'leave-owner',
  failed: 'leave-failed',
}
</script>

<template>
  <div :class="schoolRowClasses">
    <span>{{ props.school.name }}</span>

    <Button
      variant="danger"
      :disabled="stage === 'leaving' || stage === 'left'"
      @click="onLeaveClicked"
    >
      {{ $t('leave-action') }}
    </Button>

    <p v-if="notice" :class="mutedClasses">{{ $t(notice) }}</p>

    <AlertDialog
      v-model:open="asking"
      :title="$t('leave-title', { school: props.school.name })"
      :description="cost"
      :confirm-label="$t('leave-action')"
      destructive
      @confirm="onConfirmed"
    />
  </div>
</template>
