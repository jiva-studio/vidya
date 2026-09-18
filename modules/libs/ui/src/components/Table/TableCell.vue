<script setup lang="ts">
import { cn } from '../../lib/utils'
import { cellVariants } from './styles'
import type { TableCellProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<TableCellProps>(), {
  align: undefined,
  numeric: false,
  muted: false,
  strong: false,
  class: undefined,
})
</script>

<template>
  <td
    :class="
      cn(
        cellVariants({
          align: props.align ?? (props.numeric ? 'end' : 'start'),
          numeric: props.numeric,
          muted: props.muted,
          strong: props.strong,
        }),
        props.class,
      )
    "
  >
    <slot />
  </td>
</template>
