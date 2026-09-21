<script setup lang="ts">
import type { RoleId } from '@vidya/domain'
import type { TableColumn, TableRowData } from '@vidya/ui'
import { Table, TableFilters } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { RoleRow } from '@/entities/role'
import { useRoles } from '@/entities/role'
import { useCan } from '@/shared/access'

import RolesTableRow from './RolesTableRow.vue'
import { ListPage } from '@/widgets/list-page'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const router = useRouter()
const roles = useRoles()
const search = ref('')

const canCreate = useCan('roles:create')
const canUpdate = useCan('roles:update')

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: $t('roles-column-name') },
  { key: 'description', label: $t('roles-column-description') },
  { key: 'actions', label: $t('roles-column-actions'), align: 'end' },
])

const emptyActionLabel = computed(() => (canCreate.value ? $t('roles-create') : undefined))

const displayedRows = computed(() => {
  if (!search.value.trim()) return roles.rows.value
  const query = search.value.trim().toLowerCase()
  return roles.rows.value.filter(
    (role) =>
      role.name.toLowerCase().includes(query) ||
      (role.description && role.description.toLowerCase().includes(query)),
  )
})

/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void roles.load()
})

/* -------------------------------- Handlers -------------------------------- */

function onCreate() {
  void router.push({ name: 'role-new' })
}

function onEdit(id: RoleId) {
  void router.push({ name: 'role-edit', params: { id } })
}

function onRetry() {
  void roles.load()
}

function onClear() {
  search.value = ''
}

/* -------------------------------- Helpers --------------------------------- */

function asRole(row: TableRowData): RoleRow {
  return row as RoleRow
}
</script>

<template>
  <ListPage
    :title="$t('roles-title')"
    :create-label="canCreate ? $t('roles-create') : undefined"
    :page="roles.page.value"
    :total="roles.total.value"
    :paged="roles.paged.value"
    @create="onCreate"
    @update:page="roles.goTo"
  >
    <template #filters>
      <TableFilters
        v-if="roles.rows.value.length >= 10 || search"
        v-model:search="search"
        :search-label="$t('roles-title')"
        :filters-applied="!!search"
        @clear="onClear"
      />
    </template>
    <Table
      :columns="columns"
      :rows="displayedRows"
      :loading="roles.loading.value"
      :error="roles.error.value ? $t('state-error') : undefined"
      :empty-title="$t('roles-empty-title')"
      :empty-description="$t('roles-empty-body')"
      :empty-action-label="emptyActionLabel"
      :retry-label="$t('action-retry')"
      @retry="onRetry"
      @empty-action="onCreate"
    >
      <template #row="{ row }">
        <RolesTableRow :role="asRole(row)" :can-update="canUpdate" @edit="onEdit" />
      </template>
    </Table>
  </ListPage>
</template>
