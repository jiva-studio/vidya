<script setup lang="ts">
import type { SchoolId } from '@vidya/domain'
import type { TableColumn, TableRowData } from '@vidya/ui'
import { Table, TableFilters } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import type { SchoolRow } from '@/entities/school'
import { useSchools } from '@/entities/school'
import { useCan } from '@/shared/access'
import { ListPage } from '@/widgets/list-page'

import SchoolsTableRow from './SchoolsTableRow.vue'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const router = useRouter()
const schools = useSchools()

// Hidden rather than disabled: the server refuses regardless, and a control
// nobody can explain only spends the reader's attention.
const canCreate = useCan('schools:create')
const canUpdate = useCan('schools:update')

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: $t('schools-column-name') },
  { key: 'joiningLink', label: $t('schools-join-title'), align: 'center', width: '220px' },
])

const emptyActionLabel = computed(() => (canCreate.value ? $t('schools-create') : undefined))

/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void schools.load()
})

/* -------------------------------- Handlers -------------------------------- */

function onCreate() {
  void router.push({ name: 'school-new' })
}

function onEdit(id: SchoolId) {
  void router.push({ name: 'school-edit', params: { id } })
}

function onRetry() {
  void schools.load()
}

function onSearch(term: string) {
  schools.find(term)
}

function onClear() {
  schools.find('')
}

/* -------------------------------- Helpers --------------------------------- */

// The table hands rows back as plain records; this names the one it holds.
function asSchool(row: TableRowData): SchoolRow {
  return row as SchoolRow
}
</script>

<template>
  <ListPage
    :title="$t('schools-title')"
    :create-label="canCreate ? $t('schools-create') : undefined"
    :page="schools.page.value"
    :total="schools.total.value"
    :paged="schools.paged.value"
    @create="onCreate"
    @update:page="schools.goTo"
  >
    <template #filters>
      <TableFilters
        v-if="schools.searchable.value"
        :search="schools.query.value"
        :search-label="$t('schools-title')"
        :filters-applied="!!schools.query.value"
        @update:search="onSearch"
        @clear="onClear"
      />
    </template>
    <Table
      :columns="columns"
      :rows="schools.rows.value"
      :loading="schools.loading.value"
      :error="schools.error.value ? $t('state-error') : undefined"
      :empty-title="$t('schools-empty-title')"
      :empty-description="$t('schools-empty-body')"
      :empty-action-label="emptyActionLabel"
      :retry-label="$t('action-retry')"
      @retry="onRetry"
      @empty-action="onCreate"
    >
      <template #row="{ row }">
        <SchoolsTableRow :school="asSchool(row)" :can-update="canUpdate" @edit="onEdit" />
      </template>
    </Table>
  </ListPage>
</template>
