<script setup lang="ts">
import { IconButton, TableCell, TableRow } from '@vidya/ui'
import { Pencil } from 'lucide-vue-next'

import LessonVersionBadge from './LessonVersionBadge.vue'
import type { LessonRowEmits, LessonRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<LessonRowProps>(), { canEdit: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<LessonRowEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onEdit() {
  emit('edit', props.row.id)
}
</script>

<template>
  <TableRow>
    <TableCell align="start" numeric nowrap>{{ props.row.lessonNumber }}</TableCell>
    <TableCell tone="primary" truncate :title="props.row.title">{{ props.row.title }}</TableCell>
    <TableCell nowrap>
      <LessonVersionBadge
        :state="props.row.state"
        :published-version="props.row.publishedVersion"
        :draft-version="props.row.draftVersion"
      />
    </TableCell>
    <TableCell actions>
      <IconButton v-if="props.canEdit" :label="$t('lessons-edit')" @click="onEdit">
        <Pencil />
      </IconButton>
    </TableCell>
  </TableRow>
</template>
