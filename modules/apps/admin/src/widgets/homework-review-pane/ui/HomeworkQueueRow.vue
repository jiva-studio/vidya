<script setup lang="ts">
import { TableCell, TableRow } from '@vidya/ui'

import { HomeworkStatusBadge } from '@/entities/homework'
import { formatDate } from '@/shared/lib'

import type { HomeworkQueueRowEmits, HomeworkQueueRowProps } from '../types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<HomeworkQueueRowProps>(), { selected: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<HomeworkQueueRowEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onSelect() {
  emit('select', props.row.id)
}
</script>

<template>
  <TableRow interactive :selected="props.selected" @select="onSelect">
    <TableCell strong>{{ props.row.studentName ?? $t('homework-student-unknown') }}</TableCell>
    <TableCell muted>{{ props.row.groupName ?? props.row.courseName }}</TableCell>
    <TableCell><HomeworkStatusBadge :status="props.row.status" /></TableCell>
    <TableCell muted>{{ formatDate(props.row.submittedAt) }}</TableCell>
  </TableRow>
</template>
