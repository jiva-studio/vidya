<script setup lang="ts">
import { Button, TableCell, TableRow } from '@vidya/ui'

import { rowActionsClasses } from './styles'
import type { GroupRowEmits, GroupRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<GroupRowProps>(), { canEdit: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<GroupRowEmits>()

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
    <TableCell strong>{{ props.row.name }}</TableCell>
    <TableCell align="end" :class="rowActionsClasses">
      <Button size="sm" variant="ghost" @click="onMembers">{{ $t('groups-open-members') }}</Button>
      <Button v-if="props.canEdit" size="sm" variant="ghost" @click="onEdit">
        {{ $t('groups-edit') }}
      </Button>
    </TableCell>
  </TableRow>
</template>
