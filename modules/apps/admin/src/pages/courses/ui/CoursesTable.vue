<script setup lang="ts">
import { Table } from '@vidya/ui'
import type { TableColumn } from '@vidya/ui'
import type { CourseSummary } from '@vidya/protocol'
import { computed } from 'vue'
import { useFluent } from 'fluent-vue'

import CourseRow from './CourseRow.vue'
import type { CoursesTableEmits, CoursesTableProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<CoursesTableProps>(), {
  loading: false,
  error: undefined,
  canCreate: false,
  canEdit: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<CoursesTableEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: $t('courses-column-name') },
  { key: 'description', label: $t('courses-column-description') },
  { key: 'lessons', label: $t('courses-open-lessons'), align: 'end', width: '80px' },
])

// The empty state offers the action only to someone who may take it; a dead end
// that names a button nobody can press is not an empty state.
const emptyAction = computed(() => (props.canCreate ? $t('courses-empty-action') : undefined))

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

function onLessons(id: string) {
  emit('lessons', id)
}

/* -------------------------------- Helpers --------------------------------- */

function asCourse(row: unknown): CourseSummary {
  return row as CourseSummary
}
</script>

<template>
  <Table
    :columns="columns"
    :rows="props.rows"
    :loading="props.loading"
    :error="props.error"
    :empty-title="$t('courses-empty-title')"
    :empty-description="$t('courses-empty-body')"
    :empty-action-label="emptyAction"
    :retry-label="$t('action-retry')"
    @retry="onRetry"
    @empty-action="onEmptyAction"
  >
    <template #row="{ row }">
      <CourseRow
        :row="asCourse(row)"
        :can-edit="props.canEdit"
        @edit="onEdit"
        @lessons="onLessons"
      />
    </template>
  </Table>
</template>
