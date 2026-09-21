<script setup lang="ts">
import { IconButton, TableCell, TableRow } from '@vidya/ui'
import { Pencil, Users } from 'lucide-vue-next'
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

function onMembers() {
  emit('members', props.row.id)
}

function onEdit() {
  emit('edit', props.row.id)
}
</script>

<template>
  <TableRow>
    <TableCell tone="primary" truncate :title="props.row.name">{{ props.row.name }}</TableCell>
    <TableCell truncate :title="course">{{ course }}</TableCell>
    <TableCell actions>
      <IconButton :label="$t('groups-open-members')" @click="onMembers">
        <Users />
      </IconButton>
      <IconButton v-if="props.canEdit" :label="$t('groups-edit')" @click="onEdit">
        <Pencil />
      </IconButton>
    </TableCell>
  </TableRow>
</template>
