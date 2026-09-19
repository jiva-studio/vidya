<script setup lang="ts">
import { cn } from '../../lib/utils'
import { rowVariants } from './styles'
import type { TableRowEmits, TableRowProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<TableRowProps>(), {
  interactive: false,
  selected: false,
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<TableRowEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onSelect() {
  if (!props.interactive) return
  emit('select')
}
</script>

<template>
  <tr
    :class="
      cn(rowVariants({ interactive: props.interactive, selected: props.selected }), props.class)
    "
    :tabindex="props.interactive ? 0 : undefined"
    :aria-selected="props.interactive ? props.selected : undefined"
    @click="onSelect"
    @keydown.enter="onSelect"
  >
    <slot />
  </tr>
</template>
