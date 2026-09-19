<script setup lang="ts">
import Skeleton from '../Skeleton'
import { skeletonCellClasses, skeletonMarkClasses, skeletonRowClasses } from './styles'
import type { TableSkeletonProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<TableSkeletonProps>()

/* -------------------------------- Helpers --------------------------------- */

function markClass(align: string | undefined): string {
  return align === 'end' ? skeletonMarkClasses.end : skeletonMarkClasses.start
}
</script>

<template>
  <tbody>
    <tr v-for="row in props.rows" :key="row" :class="skeletonRowClasses">
      <td v-for="column in props.columns" :key="column.key" :class="skeletonCellClasses">
        <Skeleton shape="text" :class="markClass(column.align)" />
      </td>
    </tr>
  </tbody>
</template>
