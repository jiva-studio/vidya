<script setup lang="ts">
import { AlertDialog, IconButton } from '@vidya/ui'
import { Check, RotateCcw, Users, X } from 'lucide-vue-next'
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
const restoring = ref(false)

const isPending = computed(() => props.enrollment.status === 'pending')
const canDecide = computed(() => props.canModerate && isPending.value)
const canPlace = computed(() => props.canModerate && props.enrollment.status === 'accepted')

// A place the school took back is the one decision it may reverse, and the
// only way back is onto the course: there is no open request left to refuse,
// so giving back is offered here alone, without its usual pair.
const canRestore = computed(() => props.canModerate && props.enrollment.status === 'revoked')

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

function onRestoreAsked() {
  restoring.value = true
}

function onRestoreConfirmed() {
  restoring.value = false
  emit('accept', props.enrollment.id)
}

function onAssign() {
  emit('assign-group', props.enrollment.id)
}
</script>

<template>
  <div :class="actionsClasses">
    <IconButton
      v-if="canDecide"
      :label="$t('enrollments-accept')"
      :busy="props.busy"
      @click="onAccept"
    >
      <Check />
    </IconButton>
    <IconButton
      v-if="canDecide"
      variant="danger"
      :label="$t('enrollments-decline')"
      @click="onDeclineAsked"
    >
      <X />
    </IconButton>
    <IconButton
      v-if="canRestore"
      :label="$t('enrollments-restore')"
      :busy="props.busy"
      @click="onRestoreAsked"
    >
      <RotateCcw />
    </IconButton>
    <IconButton v-if="canPlace" :label="$t('enrollments-assign-group')" @click="onAssign">
      <Users />
    </IconButton>
    <AlertDialog
      v-model:open="confirming"
      destructive
      :title="$t('enrollments-decline-title')"
      :description="$t('enrollments-decline-consequence')"
      :confirm-label="$t('enrollments-decline')"
      :cancel-label="$t('action-cancel')"
      @confirm="onDeclineConfirmed"
    />
    <AlertDialog
      v-model:open="restoring"
      :title="$t('enrollments-restore-title')"
      :description="$t('enrollments-restore-consequence')"
      :confirm-label="$t('enrollments-restore')"
      :cancel-label="$t('action-cancel')"
      @confirm="onRestoreConfirmed"
    />
  </div>
</template>
