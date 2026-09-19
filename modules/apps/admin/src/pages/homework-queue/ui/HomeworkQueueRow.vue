<script setup lang="ts">
import { Avatar, TableCell, TableRow } from '@vidya/ui'

import { HomeworkStatusBadge } from '@/entities/homework'
import { formatDate } from '@/shared/lib'

import type { HomeworkQueueRowEmits, HomeworkQueueRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<HomeworkQueueRowProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<HomeworkQueueRowEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onOpen() {
  emit('open', props.row.id)
}
</script>

<template>
  <TableRow interactive @select="onOpen">
    <TableCell tone="primary" truncate>
      <div class="inline-flex items-center gap-[var(--space-2)]">
        <Avatar :name="props.row.studentName ?? '?'" size="sm" />
        <span class="truncate">{{ props.row.studentName ?? $t('homework-student-unknown') }}</span>
      </div>
    </TableCell>
    <TableCell truncate :title="props.row.courseName">{{ props.row.courseName }}</TableCell>
    <TableCell truncate :title="props.row.groupName">{{ props.row.groupName }}</TableCell>
    <TableCell><HomeworkStatusBadge :status="props.row.status" /></TableCell>
    <TableCell nowrap>{{ formatDate(props.row.submittedAt) }}</TableCell>
  </TableRow>
</template>
