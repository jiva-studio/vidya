<script setup lang="ts">
import type { UserId } from '@vidya/domain'
import type { TableColumn, TableRowData } from '@vidya/ui'
import { PageHeader, Table, TableFilters } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { UserRow } from '@/entities/user'
import { useUsers } from '@/entities/user'

import { pageClasses } from './styles'
import UsersTableRow from './UsersTableRow.vue'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const router = useRouter()
const users = useUsers()
const search = ref('')

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: $t('users-column-name') },
  { key: 'actions', label: $t('users-column-actions'), align: 'end' },
])

const displayedRows = computed(() => {
  if (!search.value.trim()) return users.rows.value
  const query = search.value.trim().toLowerCase()
  return users.rows.value.filter((user) => user.name.toLowerCase().includes(query))
})

// A list narrowed to nothing is not an empty school: saying so is the only
// feedback a search that matched nothing can give.
const searching = computed(() => search.value.trim().length > 0)
const emptyTitle = computed(() =>
  searching.value ? $t('users-no-matches-title') : $t('users-empty-title'),
)
const emptyDescription = computed(() =>
  searching.value ? $t('users-no-matches-body') : $t('users-empty-body'),
)

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

function onClear() {
  search.value = ''
}

/* -------------------------------- Helpers --------------------------------- */

function asUser(row: TableRowData): UserRow {
  return row as UserRow
}
</script>

<template>
  <section :class="pageClasses">
    <PageHeader :title="$t('users-title')" :description="$t('users-description')" />
    <TableFilters
      v-if="users.rows.value.length >= 10 || search"
      v-model:search="search"
      :search-label="$t('users-title')"
      :filters-applied="!!search"
      @clear="onClear"
    />
    <Table
      :columns="columns"
      :rows="displayedRows"
      :loading="users.loading.value"
      :error="users.error.value ? $t('state-error') : undefined"
      :empty-title="emptyTitle"
      :empty-description="emptyDescription"
      :retry-label="$t('action-retry')"
      @retry="onRetry"
    >
      <template #row="{ row }">
        <UsersTableRow :user="asUser(row)" @open="onOpen" />
      </template>
    </Table>
  </section>
</template>
