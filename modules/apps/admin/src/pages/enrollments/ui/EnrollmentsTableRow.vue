<script setup lang="ts">
import type { EnrollmentId } from '@vidya/domain'
import { TableCell, TableRow } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { EnrollmentStatusBadge } from '@/entities/enrollment'

import StudentCell from './StudentCell.vue'
import { ModerationActions } from '@/features/moderate-enrollment'
import { formatDate } from '@/shared/lib'

import { secondaryLineClasses, stackClasses } from './styles'
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
      <div :class="stackClasses">
        <EnrollmentStatusBadge
          :status="props.enrollment.status"
          :in-queue="props.enrollment.inQueue"
        />
        <span v-if="props.enrollment.decidedAt" :class="secondaryLineClasses">
          {{
            $t('enrollments-decided-by', {
              who: decidedBy,
              at: formatDate(props.enrollment.decidedAt),
            })
          }}
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
        @assign-group="onAssign"
      />
    </TableCell>
  </TableRow>
</template>
