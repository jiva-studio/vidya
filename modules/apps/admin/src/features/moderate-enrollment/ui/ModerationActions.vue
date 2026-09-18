<script setup lang="ts">
import { AlertDialog, Button } from '@vidya/ui'
import { computed, ref } from 'vue'

import type { ModerationActionsEmits, ModerationActionsProps } from '../types'
import { actionsClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<ModerationActionsProps>(), {
  canModerate: false,
  busy: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<ModerationActionsEmits>()

/* --------------------------------- State ---------------------------------- */

const confirming = ref(false)

const isPending = computed(() => props.enrollment.status === 'pending')
const canDecide = computed(() => props.canModerate && isPending.value)
const canPlace = computed(() => props.canModerate && props.enrollment.status === 'accepted')

/* -------------------------------- Handlers -------------------------------- */

function onAccept() {
  emit('accept', props.enrollment.id)
}

function onDeclineAsked() {
  confirming.value = true
}

function onDeclineConfirmed() {
  confirming.value = false
  emit('decline', props.enrollment.id)
}

function onAssign() {
  emit('assign-group', props.enrollment.id)
}
</script>

<template>
  <div :class="actionsClasses">
    <Button v-if="canDecide" size="sm" :busy="props.busy" @click="onAccept">
      {{ $t('enrollments-accept') }}
    </Button>
    <Button v-if="canDecide" variant="ghost" size="sm" @click="onDeclineAsked">
      {{ $t('enrollments-decline') }}
    </Button>
    <Button v-if="canPlace" variant="secondary" size="sm" @click="onAssign">
      {{ $t('enrollments-assign-group') }}
    </Button>
    <AlertDialog
      v-model:open="confirming"
      destructive
      :title="$t('enrollments-decline-title')"
      :description="$t('enrollments-decline-consequence')"
      :confirm-label="$t('enrollments-decline')"
      :cancel-label="$t('action-cancel')"
      @confirm="onDeclineConfirmed"
    />
  </div>
</template>
