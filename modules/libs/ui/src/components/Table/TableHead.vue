<script setup lang="ts">
import { cn } from '../../lib/utils'
import { headCellVariants, headRowClasses } from './styles'
import type { TableHeadProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<TableHeadProps>(), { class: undefined })

/* -------------------------------- Helpers --------------------------------- */

function alignOf(align: 'start' | 'end' | undefined, numeric: boolean | undefined) {
  if (align) return align
  return numeric ? 'end' : 'start'
}
</script>

<template>
  <thead :class="props.class">
    <tr :class="headRowClasses">
      <th
        v-for="column in props.columns"
        :key="column.key"
        scope="col"
        :class="cn(headCellVariants({ align: alignOf(column.align, column.numeric) }))"
      >
        {{ column.label }}
      </th>
    </tr>
  </thead>
</template>
