<script setup lang="ts">
import { IconButton, TableCell, TableRow } from '@vidya/ui'
import { Users } from 'lucide-vue-next'
import { computed } from 'vue'

import type { GroupRowEmits, GroupRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<GroupRowProps>(), { canEdit: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<GroupRowEmits>()

/* --------------------------------- State ---------------------------------- */

// The course of a group the operator may see but whose course they may not is
// a dash, not a blank cell: the column still lines up.
const course = computed(() => props.row.courseName ?? '—')

/* -------------------------------- Handlers -------------------------------- */

function onRowClick() {
  if (props.canEdit) {
    emit('edit', props.row.id)
  }
}

function onMembers(event: MouseEvent) {
  event.stopPropagation()
  emit('members', props.row.id)
}
</script>

<template>
  <TableRow :interactive="props.canEdit" @select="onRowClick">
    <TableCell tone="primary" truncate :title="props.row.name">{{ props.row.name }}</TableCell>
    <TableCell truncate :title="course">{{ course }}</TableCell>
    <TableCell align="end">
      <IconButton :label="$t('groups-open-members')" @click="onMembers">
        <Users />
      </IconButton>
    </TableCell>
  </TableRow>
</template>
