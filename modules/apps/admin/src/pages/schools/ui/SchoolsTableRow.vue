<script setup lang="ts">
import { Button, TableCell, TableRow } from '@vidya/ui'
import { Check, Copy } from 'lucide-vue-next'

import { useJoiningLink } from '../model'
import type { SchoolsTableRowEmits, SchoolsTableRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<SchoolsTableRowProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SchoolsTableRowEmits>()

/* --------------------------------- State ---------------------------------- */

const joining = useJoiningLink(props.school.id)

/* -------------------------------- Handlers -------------------------------- */

function onRowClick() {
  if (props.canUpdate) {
    emit('edit', props.school.id)
  }
}

async function onCopyLink(event: MouseEvent) {
  event.stopPropagation()

  if (!joining.link.value) {
    await joining.create()
  }

  if (joining.link.value) {
    await joining.copy()
  }
}
</script>

<template>
  <TableRow :interactive="props.canUpdate" @select="onRowClick">
    <TableCell tone="primary" truncate :title="props.school.name">
      {{ props.school.name }}
    </TableCell>
    <TableCell align="center">
      <Button
        variant="ghost"
        size="sm"
        :busy="joining.busy.value"
        data-test="copy-join-link"
        class="gap-1.5"
        @click="onCopyLink"
      >
        <Check v-if="joining.copied.value" class="h-4 w-4 text-emerald-600 shrink-0" />
        <Copy v-else class="h-4 w-4 text-slate-500 shrink-0" />
        <span>
          {{ joining.copied.value ? $t('schools-join-copied') : $t('schools-join-copy') }}
        </span>
      </Button>
    </TableCell>
  </TableRow>
</template>
