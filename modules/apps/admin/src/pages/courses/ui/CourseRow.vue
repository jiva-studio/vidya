<script setup lang="ts">
import { IconButton, TableCell, TableRow } from '@vidya/ui'
import { BookOpen, Pencil } from 'lucide-vue-next'

import type { CourseRowEmits, CourseRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<CourseRowProps>(), { canEdit: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<CourseRowEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onLessons() {
  emit('lessons', props.row.id)
}

function onEdit() {
  emit('edit', props.row.id)
}
</script>

<template>
  <TableRow>
    <TableCell tone="primary" truncate :title="props.row.name">{{ props.row.name }}</TableCell>
    <TableCell truncate :title="props.row.description">
      {{ props.row.description || $t('courses-no-description') }}
    </TableCell>
    <TableCell actions>
      <IconButton :label="$t('courses-open-lessons')" @click="onLessons">
        <BookOpen />
      </IconButton>
      <IconButton v-if="props.canEdit" :label="$t('courses-edit')" @click="onEdit">
        <Pencil />
      </IconButton>
    </TableCell>
  </TableRow>
</template>
