<script setup lang="ts">
import type { HomeworkId } from '@vidya/domain'
import type { TableColumn, TableRowData } from '@vidya/ui'
import { PageHeader, Table } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import type { HomeworkFilters, HomeworkRow } from '@/entities/homework'

import { useHomeworkRows } from '../model'
import HomeworkQueueFilters from './HomeworkQueueFilters.vue'
import HomeworkQueueRow from './HomeworkQueueRow.vue'
import { sectionClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const router = useRouter()
const queue = useHomeworkRows()

const columns = computed<TableColumn[]>(() => [
  { key: 'student', label: $t('homework-column-student') },
  { key: 'course', label: $t('homework-column-course') },
  { key: 'group', label: $t('homework-column-group') },
  { key: 'status', label: $t('homework-column-status') },
  { key: 'submitted', label: $t('homework-column-submitted') },
])


/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void queue.load()
})

/* -------------------------------- Handlers -------------------------------- */

function onFilters(filters: HomeworkFilters) {
  const refetch = filters.status !== queue.filters.value.status
  queue.filters.value = filters
  if (refetch) void queue.load()
}

function onRetry() {
  void queue.load()
}

function onOpen(id: HomeworkId) {
  void router.push({ name: 'homework-review', params: { id } })
}

/* -------------------------------- Helpers --------------------------------- */

function asWork(row: TableRowData): HomeworkRow {
  return row as HomeworkRow
}
</script>

<template>
  <section :class="sectionClasses">
    <PageHeader :title="$t('homework-title')" />
    <HomeworkQueueFilters
      :filters="queue.filters.value"
      :course-options="queue.directory.courseOptions.value"
      :group-options="queue.directory.groupOptions.value"
      @update:filters="onFilters"
    />
    <Table
      :columns="columns"
      :rows="queue.rows.value"
      :loading="queue.loading.value"
      :error="queue.error.value ? $t('state-error') : undefined"
      :empty-title="$t('homework-empty-title')"
      :empty-description="$t('homework-empty-body')"
      :retry-label="$t('action-retry')"
      @retry="onRetry"
    >
      <template #row="{ row }">
        <HomeworkQueueRow :row="asWork(row)" @open="onOpen" />
      </template>
    </Table>
  </section>
</template>
