<script setup lang="ts">
import { IconButton, TableCell, TableRow } from '@vidya/ui'
import { ArrowRight } from 'lucide-vue-next'

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
    <TableCell tone="primary" truncate :title="props.user.name">{{ props.user.name }}</TableCell>
    <TableCell actions>
      <IconButton :label="$t('users-open')" @click="onOpen">
        <ArrowRight />
      </IconButton>
    </TableCell>
  </TableRow>
</template>
