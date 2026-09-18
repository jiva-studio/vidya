<script setup lang="ts">
import type { UserId } from '@vidya/domain'
import type { TableColumn, TableRowData } from '@vidya/ui'
import { PageHeader, Table } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import type { UserRow } from '@/entities/user'
import { useUsers } from '@/entities/user'

import { sectionClasses } from './styles'
import UsersTableRow from './UsersTableRow.vue'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const router = useRouter()
const users = useUsers()

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: $t('users-column-name') },
  { key: 'actions', label: $t('users-column-actions'), align: 'end' },
])

const errorText = computed(() => (users.error.value ? $t(users.error.value) : undefined))

/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void users.load()
})

/* -------------------------------- Handlers -------------------------------- */

function onOpen(id: UserId) {
  void router.push({ name: 'user', params: { id } })
}

function onRetry() {
  void users.load()
}

/* -------------------------------- Helpers --------------------------------- */

function asUser(row: TableRowData): UserRow {
  return row as UserRow
}
</script>

<template>
  <section :class="sectionClasses">
    <PageHeader :title="$t('users-title')" :description="$t('users-description')" />
    <Table
      :columns="columns"
      :rows="users.rows.value"
      :loading="users.loading.value"
      :error="errorText"
      :empty-title="$t('users-empty-title')"
      :empty-description="$t('users-empty-body')"
      :retry-label="$t('action-retry')"
      @retry="onRetry"
    >
      <template #row="{ row }">
        <UsersTableRow :user="asUser(row)" @open="onOpen" />
      </template>
    </Table>
  </section>
</template>
