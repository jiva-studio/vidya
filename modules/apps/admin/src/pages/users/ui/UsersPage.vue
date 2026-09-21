<script setup lang="ts">
import type { UserId } from '@vidya/domain'
import type { TableColumn, TableRowData } from '@vidya/ui'
import { PageHeader, Pagination, Table, TableFilters } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import type { UserRow } from '@/entities/user'
import { PAGE_SIZE, useUsers } from '@/entities/user'

import { pageClasses } from './styles'
import UsersTableRow from './UsersTableRow.vue'
import { PageBack } from '@/widgets/page-back'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const router = useRouter()
const users = useUsers()

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: $t('users-column-name') },
  { key: 'roles', label: $t('users-column-roles') },
  { key: 'actions', label: $t('users-column-actions'), align: 'end' },
])

// A list narrowed to nothing is not an empty school: saying so is the only
// feedback a search that matched nothing can give.
const searching = computed(() => users.search.value.trim().length > 0)
const emptyTitle = computed(() =>
  searching.value ? $t('users-no-matches-title') : $t('users-empty-title'),
)
const emptyDescription = computed(() =>
  searching.value ? $t('users-no-matches-body') : $t('users-empty-body'),
)

const paged = computed(() => users.pages.value > 1)

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

function onSearch(term: string) {
  users.find(term)
}

function onClear() {
  users.find('')
}

function onPage(page: number) {
  users.goTo(page)
}

/* -------------------------------- Helpers --------------------------------- */

function asUser(row: TableRowData): UserRow {
  return row as UserRow
}
</script>

<template>
  <section :class="pageClasses">
    <PageHeader :title="$t('users-title')" :description="$t('users-description')">
      <template #leading><PageBack /></template>
    </PageHeader>
    <TableFilters
      :search="users.search.value"
      :search-label="$t('users-title')"
      :filters-applied="searching"
      @update:search="onSearch"
      @clear="onClear"
    />
    <Table
      :columns="columns"
      :rows="users.rows.value"
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
    <Pagination
      v-if="paged"
      :page="users.page.value"
      :per-page="PAGE_SIZE"
      :total="users.total.value"
      @update:page="onPage"
    />
  </section>
</template>
