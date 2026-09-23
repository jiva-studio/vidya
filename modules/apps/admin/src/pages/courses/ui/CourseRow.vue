<script setup lang="ts">
import { Badge, IconButton, TableCell, TableRow } from '@vidya/ui'
import { BookOpen } from 'lucide-vue-next'
import { computed } from 'vue'

import { nameClasses, nameGroupClasses } from './styles'
import type { CourseRowEmits, CourseRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<CourseRowProps>(), { canEdit: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<CourseRowEmits>()

/* --------------------------------- State ---------------------------------- */

const draft = computed(() => props.row.status === 'draft')

/* -------------------------------- Handlers -------------------------------- */

function onRowClick() {
  if (props.canEdit) {
    emit('edit', props.row.id)
  }
}

function onLessons(event: MouseEvent) {
  event.stopPropagation()
  emit('lessons', props.row.id)
}
</script>

<template>
  <TableRow :interactive="props.canEdit" @select="onRowClick">
    <TableCell tone="primary" :title="props.row.name">
      <span :class="nameGroupClasses">
        <span :class="nameClasses">{{ props.row.name }}</span>
        <Badge v-if="draft" tone="neutral">{{ $t('courses-draft') }}</Badge>
      </span>
    </TableCell>
    <TableCell truncate :title="props.row.description">
      {{ props.row.description || $t('courses-no-description') }}
    </TableCell>
    <TableCell align="end">
      <IconButton :label="$t('courses-open-lessons')" @click="onLessons">
        <BookOpen />
      </IconButton>
    </TableCell>
  </TableRow>
</template>
