<script setup lang="ts">
import { Badge, IconButton, TableCell, TableRow } from '@vidya/ui'
import { BookOpen, Pencil } from 'lucide-vue-next'
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

function onLessons() {
  emit('lessons', props.row.id)
}

function onEdit() {
  emit('edit', props.row.id)
}
</script>

<template>
  <TableRow>
    <TableCell tone="primary" :title="props.row.name">
      <span :class="nameGroupClasses">
        <span :class="nameClasses">{{ props.row.name }}</span>
        <Badge v-if="draft" tone="neutral">{{ $t('courses-draft') }}</Badge>
      </span>
    </TableCell>
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
