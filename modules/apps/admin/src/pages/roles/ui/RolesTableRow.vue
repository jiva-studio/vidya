<script setup lang="ts">
import { TableCell, TableRow } from '@vidya/ui'

import type { RolesTableRowEmits, RolesTableRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<RolesTableRowProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<RolesTableRowEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onRowClick() {
  if (props.canUpdate) {
    emit('edit', props.role.id)
  }
}
</script>

<template>
  <TableRow :interactive="props.canUpdate" @select="onRowClick">
    <TableCell tone="primary" truncate :title="props.role.name">{{ props.role.name }}</TableCell>
    <TableCell truncate :title="props.role.description">{{ props.role.description }}</TableCell>
  </TableRow>
</template>
