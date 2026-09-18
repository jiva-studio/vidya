<script setup lang="ts">
import type { HomeworkId } from '@vidya/domain'
import type { TableColumn, TableRowData } from '@vidya/ui'
import { Table } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import type { HomeworkRow } from '@/entities/homework'

import type { HomeworkQueueTableEmits, HomeworkQueueTableProps } from '../types'
import HomeworkQueueRow from './HomeworkQueueRow.vue'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<HomeworkQueueTableProps>(), {
  selectedId: undefined,
  loading: false,
  error: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<HomeworkQueueTableEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const columns = computed<TableColumn[]>(() => [
  { key: 'student', label: $t('homework-column-student') },
  { key: 'group', label: $t('homework-column-group') },
  { key: 'status', label: $t('homework-column-status') },
  { key: 'submitted', label: $t('homework-column-submitted') },
])

/* -------------------------------- Handlers -------------------------------- */

function onSelect(id: HomeworkId) {
  emit('select', id)
}

function onRetry() {
  emit('retry')
}

/* -------------------------------- Helpers --------------------------------- */

function asWork(row: TableRowData): HomeworkRow {
  return row as HomeworkRow
}

function isSelected(row: TableRowData): boolean {
  return asWork(row).id === props.selectedId
}
</script>

<template>
  <Table
    :columns="columns"
    :rows="props.rows"
    :loading="props.loading"
    :error="props.error"
    :empty-title="$t('homework-empty-title')"
    :empty-description="$t('homework-empty-body')"
    :retry-label="$t('action-retry')"
    @retry="onRetry"
  >
    <template #row="{ row }">
      <HomeworkQueueRow :row="asWork(row)" :selected="isSelected(row)" @select="onSelect" />
    </template>
  </Table>
</template>
