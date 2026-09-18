<script setup lang="ts">
import { Button, TableCell, TableRow } from '@vidya/ui'

import { actionsClass } from './styles'
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
    <TableCell strong>{{ props.role.name }}</TableCell>
    <TableCell muted>{{ props.role.description }}</TableCell>
    <TableCell align="end" :class="actionsClass">
      <Button v-if="props.canUpdate" variant="ghost" size="sm" @click="onEdit">
        {{ $t('roles-edit') }}
      </Button>
    </TableCell>
  </TableRow>
</template>
