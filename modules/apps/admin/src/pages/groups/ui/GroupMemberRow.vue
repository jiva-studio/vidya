<script setup lang="ts">
import type { EnrollmentStatus } from '@vidya/domain'
import { Avatar, Badge, TableCell, TableRow } from '@vidya/ui'
import type { BadgeTone } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { formatDate } from '@/shared/lib'

import type { GroupMemberRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<GroupMemberRowProps>()

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

const name = computed(() => nameText())
const tone = computed<BadgeTone>(() => tones[props.row.status])
const status = computed(() => `group-members-status-${props.row.status}`)
const since = computed(() => formatDate(props.row.enrolledAt))

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
  </TableRow>
</template>
