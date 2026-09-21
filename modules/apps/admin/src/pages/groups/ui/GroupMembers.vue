<script setup lang="ts">
import { Table } from '@vidya/ui'
import type { TableColumn } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import type { GroupMember } from '@/entities/group'

import GroupMemberRow from './GroupMemberRow.vue'
import type { GroupMembersEmits, GroupMembersProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<GroupMembersProps>(), {
  loading: false,
  error: undefined,
  canModerate: false,
  busy: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<GroupMembersEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: $t('group-members-column-name') },
  { key: 'status', label: $t('group-members-column-status') },
  { key: 'since', label: $t('group-members-column-since') },
  { key: 'actions', label: $t('group-members-column-actions'), align: 'end' },
])

/* -------------------------------- Handlers -------------------------------- */

function onRetry() {
  emit('retry')
}

function onRevoke(enrollmentId: string) {
  emit('revoke', enrollmentId)
}

function onRestore(enrollmentId: string) {
  emit('restore', enrollmentId)
}

function onMove(enrollmentId: string) {
  emit('move', enrollmentId)
}

/* -------------------------------- Helpers --------------------------------- */

function asMember(row: unknown): GroupMember {
  return row as GroupMember
}
</script>

<template>
  <Table
    :columns="columns"
    :rows="props.rows"
    :loading="props.loading"
    :error="props.error"
    row-key="enrollmentId"
    :empty-title="$t('group-members-empty-title')"
    :empty-description="$t('group-members-empty-body')"
    :retry-label="$t('action-retry')"
    @retry="onRetry"
  >
    <template #row="{ row }">
      <GroupMemberRow
        :row="asMember(row)"
        :can-moderate="props.canModerate"
        :busy="props.busy === asMember(row).enrollmentId"
        @revoke="onRevoke"
        @restore="onRestore"
        @move="onMove"
      />
    </template>
  </Table>
</template>
