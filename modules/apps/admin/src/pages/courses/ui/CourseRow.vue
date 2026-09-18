<script setup lang="ts">
import { Button, TableCell, TableRow } from '@vidya/ui'

import type { CourseRowEmits, CourseRowProps } from './types'
import { rowActionsClasses } from './styles'

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
    <TableCell strong>{{ props.row.name }}</TableCell>
    <TableCell muted>{{ props.row.description || $t('courses-no-description') }}</TableCell>
    <TableCell align="end" :class="rowActionsClasses">
      <Button size="sm" variant="ghost" @click="onLessons">{{ $t('courses-open-lessons') }}</Button>
      <Button v-if="props.canEdit" size="sm" variant="ghost" @click="onEdit">
        {{ $t('courses-edit') }}
      </Button>
    </TableCell>
  </TableRow>
</template>
