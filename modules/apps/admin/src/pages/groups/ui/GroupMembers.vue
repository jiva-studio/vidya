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
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<GroupMembersEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: $t('group-members-column-name') },
  { key: 'status', label: $t('group-members-column-status') },
  { key: 'since', label: $t('group-members-column-since') },
])

/* -------------------------------- Handlers -------------------------------- */

function onRetry() {
  emit('retry')
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
      <GroupMemberRow :row="asMember(row)" />
    </template>
  </Table>
</template>
