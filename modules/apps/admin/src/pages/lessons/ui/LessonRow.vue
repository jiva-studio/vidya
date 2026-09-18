<script setup lang="ts">
import { Button, TableCell, TableRow } from '@vidya/ui'

import LessonVersionBadge from './LessonVersionBadge.vue'
import { rowActionsClasses } from './styles'
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
    <TableCell numeric>{{ props.row.lessonNumber }}</TableCell>
    <TableCell strong>{{ props.row.title }}</TableCell>
    <TableCell>
      <LessonVersionBadge
        :state="props.row.state"
        :published-version="props.row.publishedVersion"
        :draft-version="props.row.draftVersion"
      />
    </TableCell>
    <TableCell align="end" :class="rowActionsClasses">
      <Button v-if="props.canEdit" size="sm" variant="ghost" @click="onEdit">
        {{ $t('lessons-edit') }}
      </Button>
    </TableCell>
  </TableRow>
</template>
