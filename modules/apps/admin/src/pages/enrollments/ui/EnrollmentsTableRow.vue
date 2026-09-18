<script setup lang="ts">
import type { EnrollmentId } from '@vidya/domain'
import { TableCell, TableRow } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { EnrollmentStatusBadge } from '@/entities/enrollment'
import { ModerationActions } from '@/features/moderate-enrollment'
import { formatDate, formatDateTime } from '@/shared/lib'

import type { EnrollmentsTableRowEmits, EnrollmentsTableRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<EnrollmentsTableRowProps>(), {
  canModerate: false,
  busy: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<EnrollmentsTableRowEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const group = computed(() => props.enrollment.groupName ?? '—')
const decidedBy = computed(() => props.enrollment.decidedByName ?? '—')

/* -------------------------------- Handlers -------------------------------- */

function onAccept(id: EnrollmentId) {
  emit('accept', id)
}

function onDecline(id: EnrollmentId) {
  emit('decline', id)
}

function onAssign(id: EnrollmentId) {
  emit('assign-group', id)
}
</script>

<template>
  <TableRow>
    <TableCell strong>
      {{ props.enrollment.studentName ?? $t('enrollments-student-unknown') }}
    </TableCell>
    <TableCell muted>{{ props.enrollment.courseName }}</TableCell>
    <TableCell muted>{{ group }}</TableCell>
    <TableCell>
      <EnrollmentStatusBadge
        :status="props.enrollment.status"
        :in-queue="props.enrollment.inQueue"
      />
    </TableCell>
    <TableCell muted>{{ formatDate(props.enrollment.createdAt) }}</TableCell>
    <TableCell muted>
      <span v-if="props.enrollment.decidedAt">
        {{
          $t('enrollments-decided-by', {
            who: decidedBy,
            at: formatDateTime(props.enrollment.decidedAt),
          })
        }}
      </span>
    </TableCell>
    <TableCell align="end">
      <ModerationActions
        :enrollment="props.enrollment"
        :can-moderate="props.canModerate"
        :busy="props.busy"
        @accept="onAccept"
        @decline="onDecline"
        @assign-group="onAssign"
      />
    </TableCell>
  </TableRow>
</template>
