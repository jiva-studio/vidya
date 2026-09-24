<script setup lang="ts">
import { Table } from '@vidya/ui'
import type { TableColumn } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import GroupRow from './GroupRow.vue'
import type { GroupListRow, GroupsTableEmits, GroupsTableProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<GroupsTableProps>(), {
  emptyTitle: undefined,
  emptyDescription: undefined,
  loading: false,
  error: undefined,
  canCreate: false,
  canEdit: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<GroupsTableEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: $t('groups-column-name') },
  { key: 'course', label: $t('groups-column-course') },
  { key: 'members', label: $t('groups-open-members'), align: 'end', width: '80px' },
])

const emptyAction = computed(() => (props.canCreate ? $t('groups-empty-action') : undefined))

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

function onMembers(id: string) {
  emit('members', id)
}

/* -------------------------------- Helpers --------------------------------- */

function asGroup(row: unknown): GroupListRow {
  return row as GroupListRow
}
</script>

<template>
  <Table
    :columns="columns"
    :rows="props.rows"
    :loading="props.loading"
    :error="props.error"
    :empty-title="props.emptyTitle ?? $t('groups-empty-title')"
    :empty-description="props.emptyDescription ?? $t('groups-empty-body')"
    :empty-action-label="emptyAction"
    :retry-label="$t('action-retry')"
    @retry="onRetry"
    @empty-action="onEmptyAction"
  >
    <template #row="{ row }">
      <GroupRow :row="asGroup(row)" :can-edit="props.canEdit" @edit="onEdit" @members="onMembers" />
    </template>
  </Table>
</template>
