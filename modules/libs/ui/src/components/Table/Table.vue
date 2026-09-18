<script setup lang="ts">
import { computed } from 'vue'

import EmptyState from '../EmptyState'
import ErrorState from '../ErrorState'
import Skeleton from '../Skeleton'
import TableHead from './TableHead.vue'
import { cn } from '../../lib/utils'
import { captionClasses, frameClasses, loadingClasses, tableClasses } from './styles'
import type { TableEmits, TableProps, TableRowData } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<TableProps>(), {
  rowKey: 'id',
  caption: undefined,
  loading: false,
  error: undefined,
  emptyTitle: 'Nothing here yet',
  emptyDescription: 'Add the first record to see it listed here.',
  emptyActionLabel: undefined,
  retryLabel: 'Try again',
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<TableEmits>()

/* --------------------------------- State ---------------------------------- */

const isEmpty = computed(() => !props.loading && !props.error && props.rows.length === 0)
const showRows = computed(() => !props.loading && !props.error && props.rows.length > 0)

/* -------------------------------- Handlers -------------------------------- */

function onRetry() {
  emit('retry')
}

function onEmptyAction() {
  emit('empty-action')
}

/* -------------------------------- Helpers --------------------------------- */

function keyOf(row: TableRowData, index: number): string {
  const value = row[props.rowKey]
  return value === undefined ? String(index) : String(value)
}
</script>

<template>
  <ErrorState
    v-if="props.error"
    :description="props.error"
    :retry-label="props.retryLabel"
    :class="props.class"
    @retry="onRetry"
  />
  <div v-else-if="props.loading" :class="cn(loadingClasses, props.class)">
    <Skeleton shape="text" :lines="1" />
    <Skeleton shape="block" :lines="4" />
  </div>
  <EmptyState
    v-else-if="isEmpty"
    :title="props.emptyTitle"
    :description="props.emptyDescription"
    :action-label="props.emptyActionLabel"
    :class="props.class"
    @action="onEmptyAction"
  />
  <div v-else-if="showRows" :class="cn(frameClasses, props.class)">
    <table :class="tableClasses">
      <caption v-if="props.caption" :class="captionClasses">
        {{ props.caption }}
      </caption>
      <colgroup>
        <col v-for="column in props.columns" :key="column.key" :style="{ width: column.width }" />
      </colgroup>
      <TableHead :columns="props.columns" />
      <tbody>
        <slot
          v-for="(row, index) in props.rows"
          :key="keyOf(row, index)"
          name="row"
          :row="row"
          :index="index"
        />
      </tbody>
    </table>
  </div>
</template>
