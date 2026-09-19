<script setup lang="ts">
import { IconButton, TableCell, TableRow } from '@vidya/ui'
import { Pencil } from 'lucide-vue-next'

import type { RolesTableRowEmits, RolesTableRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<RolesTableRowProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<RolesTableRowEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onEdit() {
  emit('edit', props.role.id)
}
</script>

<template>
  <TableRow>
    <TableCell tone="primary" truncate :title="props.role.name">{{ props.role.name }}</TableCell>
    <TableCell truncate :title="props.role.description">{{ props.role.description }}</TableCell>
    <TableCell actions>
      <IconButton v-if="props.canUpdate" :label="$t('roles-edit')" @click="onEdit">
        <Pencil />
      </IconButton>
    </TableCell>
  </TableRow>
</template>
