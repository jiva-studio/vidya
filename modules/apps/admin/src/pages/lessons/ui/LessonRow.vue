<script setup lang="ts">
import { TableCell, TableRow } from '@vidya/ui'

import LessonVersionBadge from './LessonVersionBadge.vue'
import type { LessonRowEmits, LessonRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<LessonRowProps & { courseName?: string }>(), {
  canEdit: false,
  showCourse: false,
  courseName: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<LessonRowEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onRowClick() {
  if (props.canEdit) {
    emit('edit', props.row)
  }
}
</script>

<template>
  <TableRow :interactive="props.canEdit" @select="onRowClick">
    <TableCell align="start" numeric nowrap>{{ props.row.lessonNumber }}</TableCell>
    <TableCell tone="primary" truncate :title="props.row.title">{{ props.row.title }}</TableCell>
    <TableCell v-if="props.showCourse" truncate :title="props.courseName">
      {{ props.courseName || '—' }}
    </TableCell>
    <TableCell align="end" nowrap>
      <LessonVersionBadge
        :state="props.row.state"
        :published-version="props.row.publishedVersion"
        :draft-version="props.row.draftVersion"
      />
    </TableCell>
  </TableRow>
</template>
