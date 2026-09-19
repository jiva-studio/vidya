<script setup lang="ts">
import { Table } from '@vidya/ui'
import type { TableColumn } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import type { LessonRow as LessonRowData } from '@/entities/lesson'

import LessonRow from './LessonRow.vue'
import type { LessonsTableEmits, LessonsTableProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<LessonsTableProps>(), {
  loading: false,
  error: undefined,
  canCreate: false,
  canEdit: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<LessonsTableEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const columns = computed<TableColumn[]>(() => [
  {
    key: 'lessonNumber',
    label: $t('lessons-column-number'),
    numeric: true,
    align: 'start',
    width: 'var(--col-index)',
  },
  { key: 'title', label: $t('lessons-column-title') },
  { key: 'state', label: $t('lessons-column-state') },
  { key: 'actions', label: $t('lessons-column-actions'), align: 'end' },
])

const emptyAction = computed(() => (props.canCreate ? $t('lessons-empty-action') : undefined))

/* -------------------------------- Handlers -------------------------------- */

function onRetry() {
  emit('retry')
}

function onEmptyAction() {
  emit('create')
}

function onEdit(id: string) {
  emit('edit', id)
}

/* -------------------------------- Helpers --------------------------------- */

function asLesson(row: unknown): LessonRowData {
  return row as LessonRowData
}
</script>

<template>
  <Table
    :columns="columns"
    :rows="props.rows"
    :loading="props.loading"
    :error="props.error"
    :empty-title="$t('lessons-empty-title')"
    :empty-description="$t('lessons-empty-body')"
    :empty-action-label="emptyAction"
    :retry-label="$t('action-retry')"
    @retry="onRetry"
    @empty-action="onEmptyAction"
  >
    <template #row="{ row }">
      <LessonRow :row="asLesson(row)" :can-edit="props.canEdit" @edit="onEdit" />
    </template>
  </Table>
</template>
