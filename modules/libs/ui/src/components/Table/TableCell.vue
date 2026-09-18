<script setup lang="ts">
import { computed } from 'vue'

import { cn } from '../../lib/utils'
import { actionsClasses, cellVariants, truncateClasses } from './styles'
import type { TableCellProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<TableCellProps>(), {
  align: undefined,
  tone: 'secondary',
  numeric: false,
  nowrap: false,
  truncate: false,
  actions: false,
  class: undefined,
})

/* --------------------------------- State ---------------------------------- */

const align = computed(() => alignOf())

const classes = computed(() =>
  cn(
    cellVariants({
      align: align.value,
      tone: props.tone,
      nowrap: props.nowrap || props.actions,
    }),
    props.class,
  ),
)

/* -------------------------------- Helpers --------------------------------- */

function alignOf() {
  if (props.align) return props.align
  return props.numeric || props.actions ? 'end' : 'start'
}
</script>

<template>
  <td :class="classes">
    <div v-if="props.actions" :class="actionsClasses">
      <slot />
    </div>
    <span v-else-if="props.truncate" :class="truncateClasses">
      <slot />
    </span>
    <slot v-else />
  </td>
</template>
