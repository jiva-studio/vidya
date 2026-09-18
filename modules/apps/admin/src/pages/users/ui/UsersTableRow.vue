<script setup lang="ts">
import { Button, TableCell, TableRow } from '@vidya/ui'

import type { UsersTableRowEmits, UsersTableRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<UsersTableRowProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<UsersTableRowEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onOpen() {
  emit('open', props.user.id)
}
</script>

<template>
  <TableRow>
    <TableCell strong>{{ props.user.name }}</TableCell>
    <TableCell align="end">
      <Button variant="ghost" size="sm" @click="onOpen">{{ $t('users-open') }}</Button>
    </TableCell>
  </TableRow>
</template>
