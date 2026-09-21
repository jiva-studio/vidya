<script setup lang="ts">
import type { EnrollmentStatus } from '@vidya/domain'
import { AlertDialog, IconButton } from '@vidya/ui'
import { Check, Eye, RotateCcw, UserMinus, Users, X } from 'lucide-vue-next'
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
const revoking = ref(false)

const isPending = computed(() => props.enrollment.status === 'pending')
const canDecide = computed(() => props.canModerate && isPending.value)
const canPlace = computed(() => props.canModerate && props.enrollment.status === 'accepted')

// Expelling is taking the place back, and it is the same action whether the
// student sits in a group or still waits in the queue.
const canRevoke = computed(() => props.canModerate && props.enrollment.status === 'accepted')

// A place that has been given up is the one decision that may be reversed, and
// the only way back is onto the course: there is no open request left to
// refuse, so giving back is offered here alone, without its usual pair. The
// school taking a place away and the student handing it back arrive at the same
// place, and the server takes both of them back to `accepted`.
const RETURNABLE: EnrollmentStatus[] = ['revoked', 'withdrawn']

const canRestore = computed(() => props.canModerate && RETURNABLE.includes(props.enrollment.status))

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

function onRevokeAsked() {
  revoking.value = true
}

function onRevokeConfirmed() {
  revoking.value = false
  emit('revoke', props.enrollment.id)
}

function onAssign() {
  emit('assign-group', props.enrollment.id)
}

function onReview() {
  emit('review', props.enrollment.id)
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
    <IconButton
      v-if="canRevoke"
      variant="danger"
      :label="$t('enrollments-revoke')"
      @click="onRevokeAsked"
    >
      <UserMinus />
    </IconButton>
    <IconButton
      v-if="props.canModerate"
      variant="ghost"
      :label="$t('enrollments-review')"
      @click="onReview"
    >
      <Eye />
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
      v-model:open="revoking"
      destructive
      :title="$t('enrollments-revoke-title')"
      :description="$t('enrollments-revoke-consequence')"
      :confirm-label="$t('enrollments-revoke')"
      :cancel-label="$t('action-cancel')"
      @confirm="onRevokeConfirmed"
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
