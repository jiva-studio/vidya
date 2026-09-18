<script setup lang="ts">
import { Badge, TableCell, TableRow } from '@vidya/ui'
import type { BadgeTone } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { formatDate } from '@/shared/lib'

import type { GroupMemberRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<GroupMemberRowProps>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const tones: Record<string, BadgeTone> = {
  pending: 'warning',
  accepted: 'success',
  declined: 'danger',
}

const name = computed(() => nameText())
const tone = computed<BadgeTone>(() => tones[props.row.status] ?? 'neutral')
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
    <TableCell tone="primary" truncate :title="name">{{ name }}</TableCell>
    <TableCell nowrap>
      <Badge :tone="tone">{{ $t(status) }}</Badge>
    </TableCell>
    <TableCell nowrap>{{ since }}</TableCell>
  </TableRow>
</template>
