<script setup lang="ts">
import type { EnrollmentStatus } from '@vidya/domain'
import { AlertDialog, Avatar, Badge, IconButton, TableCell, TableRow } from '@vidya/ui'
import type { BadgeTone } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { UserMinus, Users } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import { formatDate } from '@/shared/lib'

import type { GroupMemberRowEmits, GroupMemberRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<GroupMemberRowProps>(), {
  canModerate: false,
  busy: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<GroupMemberRowEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

// Keyed by the domain's own list, so a state added there stops the build here
// rather than reaching the roster as an unnamed grey badge.
const tones: Record<EnrollmentStatus, BadgeTone> = {
  pending: 'warning',
  accepted: 'success',
  declined: 'danger',
  revoked: 'accent',
  withdrawn: 'info',
}

const revoking = ref(false)

const name = computed(() => nameText())
const tone = computed<BadgeTone>(() => tones[props.row.status])
const status = computed(() => `group-members-status-${props.row.status}`)
const since = computed(() => formatDate(props.row.enrolledAt))

// A place that ended has no group, and the roster is read by group, so every
// row here is a live one. Putting a student back is offered on Requests.
const isAccepted = computed(() => props.row.status === 'accepted')
const canRevoke = computed(() => props.canModerate && isAccepted.value)
const canMove = computed(() => props.canModerate && isAccepted.value)

/* -------------------------------- Handlers -------------------------------- */

function onRevokeAsked() {
  revoking.value = true
}

function onRevokeConfirmed() {
  revoking.value = false
  emit('revoke', props.row.enrollmentId)
}

function onMove() {
  emit('move', props.row.enrollmentId)
}

/* -------------------------------- Helpers --------------------------------- */

// Reading the user list needs a permission a teacher may not hold, so a member
// without a name is ordinary: the row still says who by id.
function nameText(): string {
  if (props.row.name) return props.row.name
  return $t('group-members-unknown', { id: props.row.studentId ?? props.row.enrollmentId })
}
</script>

<template>
  <TableRow>
    <TableCell tone="primary" truncate :title="name">
      <div class="inline-flex items-center gap-[var(--space-2)]">
        <Avatar :name="name" size="sm" />
        <span class="truncate">{{ name }}</span>
      </div>
    </TableCell>
    <TableCell nowrap>
      <Badge :tone="tone">{{ $t(status) }}</Badge>
    </TableCell>
    <TableCell nowrap>{{ since }}</TableCell>
    <TableCell actions>
      <IconButton v-if="canMove" :label="$t('group-members-move')" @click="onMove">
        <Users />
      </IconButton>
      <IconButton
        v-if="canRevoke"
        variant="danger"
        :label="$t('group-members-revoke')"
        :busy="props.busy"
        @click="onRevokeAsked"
      >
        <UserMinus />
      </IconButton>
      <AlertDialog
        v-model:open="revoking"
        destructive
        :title="$t('group-members-revoke-title')"
        :description="$t('group-members-revoke-consequence')"
        :confirm-label="$t('group-members-revoke')"
        :cancel-label="$t('action-cancel')"
        @confirm="onRevokeConfirmed"
      />
    </TableCell>
  </TableRow>
</template>
