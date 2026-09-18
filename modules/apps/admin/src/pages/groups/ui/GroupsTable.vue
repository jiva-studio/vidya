<script setup lang="ts">
import type { GroupSummary } from '@vidya/protocol'
import { Table } from '@vidya/ui'
import type { TableColumn } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import GroupRow from './GroupRow.vue'
import type { GroupsTableEmits, GroupsTableProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<GroupsTableProps>(), {
  loading: false,
  error: undefined,
  canCreate: false,
  canEdit: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<GroupsTableEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

// `GroupSummary` is an id and a name and nothing else — no course, no
// description — so the list shows what it has and the rest is one click away.
const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: $t('groups-column-name') },
  { key: 'actions', label: $t('groups-column-actions'), align: 'end' },
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

function asGroup(row: unknown): GroupSummary {
  return row as GroupSummary
}
</script>

<template>
  <Table
    :columns="columns"
    :rows="props.rows"
    :loading="props.loading"
    :error="props.error"
    :empty-title="$t('groups-empty-title')"
    :empty-description="$t('groups-empty-body')"
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
