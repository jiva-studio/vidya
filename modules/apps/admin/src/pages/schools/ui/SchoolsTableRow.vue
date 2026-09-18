<script setup lang="ts">
import { Button, TableCell, TableRow } from '@vidya/ui'

import type { SchoolsTableRowEmits, SchoolsTableRowProps } from './types'
import { actionsClass } from './styles'

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
    <TableCell strong>{{ props.school.name }}</TableCell>
    <TableCell align="end" :class="actionsClass">
      <Button v-if="props.canUpdate" variant="ghost" size="sm" @click="onEdit">
        {{ $t('schools-edit') }}
      </Button>
      <Button v-if="props.canUpdate" variant="ghost" size="sm" @click="onSettings">
        {{ $t('schools-settings') }}
      </Button>
    </TableCell>
  </TableRow>
</template>
