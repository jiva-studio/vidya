<script setup lang="ts">
import type { EnrollmentId } from '@vidya/domain'
import { TableCell, TableRow } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { EnrollmentStatusBadge } from '@/entities/enrollment'

import StudentCell from './StudentCell.vue'
import { ArchiveAction } from '@/features/archive-enrollment'
import { ModerationActions } from '@/features/moderate-enrollment'
import { formatDate } from '@/shared/lib'

import { decisionClasses, refusalLineClasses, secondaryLineClasses } from './styles'
import type { EnrollmentsTableRowEmits, EnrollmentsTableRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<EnrollmentsTableRowProps>(), {
  canModerate: false,
  busy: false,
  archiving: false,
  archiveError: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<EnrollmentsTableRowEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const group = computed(() => props.enrollment.groupName ?? '—')

// Who decided is often unreadable — naming a person needs `users:read`, which a
// reviewer may not hold. The line then says when, and drops the dash that used
// to stand in for the name and read as a broken cell.
const decidedLine = computed(() =>
  props.enrollment.decidedByName
    ? $t('enrollments-decided-by', {
        who: props.enrollment.decidedByName,
        at: formatDate(props.enrollment.decidedAt!),
      })
    : $t('enrollments-decided-at', { at: formatDate(props.enrollment.decidedAt!) }),
)

/* -------------------------------- Handlers -------------------------------- */

function onAccept(id: EnrollmentId) {
  emit('accept', id)
}

function onDecline(id: EnrollmentId) {
  emit('decline', id)
}

function onRevoke(id: EnrollmentId) {
  emit('revoke', id)
}

function onAssign(id: EnrollmentId) {
  emit('assign-group', id)
}

function onReview(id: EnrollmentId) {
  emit('review', id)
}

function onArchive(id: EnrollmentId) {
  emit('archive', id)
}
</script>

<template>
  <TableRow>
    <TableCell tone="primary">
      <StudentCell
        :name="props.enrollment.studentName ?? $t('enrollments-student-unknown')"
        :note="$t('enrollments-requested-at', { at: formatDate(props.enrollment.createdAt) })"
      />
    </TableCell>
    <TableCell truncate :title="props.enrollment.courseName">
      {{ props.enrollment.courseName }}
    </TableCell>
    <TableCell truncate :title="group">{{ group }}</TableCell>
    <TableCell>
      <div :class="decisionClasses">
        <EnrollmentStatusBadge
          :status="props.enrollment.status"
          :in-queue="props.enrollment.inQueue"
        />
        <span v-if="props.enrollment.decidedAt" :class="secondaryLineClasses">
          {{ decidedLine }}
        </span>
      </div>
    </TableCell>
    <TableCell actions>
      <ModerationActions
        :enrollment="props.enrollment"
        :can-moderate="props.canModerate"
        :busy="props.busy"
        @accept="onAccept"
        @decline="onDecline"
        @revoke="onRevoke"
        @assign-group="onAssign"
        @review="onReview"
      />
      <ArchiveAction
        :enrollment="props.enrollment"
        :can-moderate="props.canModerate"
        :busy="props.archiving"
        @archive="onArchive"
      />
      <p v-if="props.archiveError" :class="refusalLineClasses" role="alert">
        {{ $t(props.archiveError) }}
      </p>
    </TableCell>
  </TableRow>
</template>
