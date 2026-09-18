<script setup lang="ts">
import { IconButton, TableCell, TableRow } from '@vidya/ui'
import { Pencil, Settings } from 'lucide-vue-next'

import type { SchoolsTableRowEmits, SchoolsTableRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<SchoolsTableRowProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SchoolsTableRowEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onEdit() {
  emit('edit', props.school.id)
}

function onSettings() {
  emit('settings', props.school.id)
}
</script>

<template>
  <TableRow>
    <TableCell tone="primary" truncate :title="props.school.name">
      {{ props.school.name }}
    </TableCell>
    <TableCell actions>
      <IconButton v-if="props.canUpdate" :label="$t('schools-edit')" @click="onEdit">
        <Pencil />
      </IconButton>
      <IconButton v-if="props.canUpdate" :label="$t('schools-settings')" @click="onSettings">
        <Settings />
      </IconButton>
    </TableCell>
  </TableRow>
</template>
