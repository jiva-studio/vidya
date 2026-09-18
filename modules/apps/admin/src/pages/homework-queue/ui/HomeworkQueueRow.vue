<script setup lang="ts">
import { TableCell, TableRow } from '@vidya/ui'

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
      {{ props.row.studentName ?? $t('homework-student-unknown') }}
    </TableCell>
    <TableCell truncate :title="props.row.courseName">{{ props.row.courseName }}</TableCell>
    <TableCell truncate :title="props.row.groupName">{{ props.row.groupName }}</TableCell>
    <TableCell><HomeworkStatusBadge :status="props.row.status" /></TableCell>
    <TableCell nowrap>{{ formatDate(props.row.submittedAt) }}</TableCell>
  </TableRow>
</template>
