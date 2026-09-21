<script setup lang="ts">
import type { SchoolId } from '@vidya/domain'
import type { TableColumn, TableRowData } from '@vidya/ui'
import { Button, PageHeader, Pagination, Table, TableFilters } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import type { SchoolRow } from '@/entities/school'
import { useSchools } from '@/entities/school'
import { useCan } from '@/shared/access'

import SchoolsTableRow from './SchoolsTableRow.vue'
import { sectionClasses } from './styles'
import { PageBack } from '@/widgets/page-back'
import { PAGE_SIZE } from '@/shared/lib'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const router = useRouter()
const schools = useSchools()
const search = ref('')

// Hidden rather than disabled: the server refuses regardless, and a control
// nobody can explain only spends the reader's attention.
const canCreate = useCan('schools:create')
const canUpdate = useCan('schools:update')

const columns = computed<TableColumn[]>(() => [
  { key: 'name', label: $t('schools-column-name') },
  { key: 'actions', label: $t('schools-column-actions'), align: 'end' },
])

const emptyActionLabel = computed(() => (canCreate.value ? $t('schools-create') : undefined))

const displayedRows = computed(() => {
  if (!search.value.trim()) return schools.rows.value
  const query = search.value.trim().toLowerCase()
  return schools.rows.value.filter((school) => school.name.toLowerCase().includes(query))
})

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

function onSettings(id: SchoolId) {
  void router.push({ name: 'school-settings', params: { id } })
}

function onRetry() {
  void schools.load()
}

function onClear() {
  search.value = ''
}

/* -------------------------------- Helpers --------------------------------- */

// The table hands rows back as plain records; this names the one it holds.
function asSchool(row: TableRowData): SchoolRow {
  return row as SchoolRow
}
</script>

<template>
  <section :class="sectionClasses">
    <PageHeader :title="$t('schools-title')">
      <template #leading><PageBack /></template>
      <template #actions>
        <Button v-if="canCreate" @click="onCreate">{{ $t('schools-create') }}</Button>
      </template>
    </PageHeader>
    <TableFilters
      v-if="schools.rows.value.length >= 10 || search"
      v-model:search="search"
      :search-label="$t('schools-title')"
      :filters-applied="!!search"
      @clear="onClear"
    />
    <Table
      :columns="columns"
      :rows="displayedRows"
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
        <SchoolsTableRow
          :school="asSchool(row)"
          :can-update="canUpdate"
          @edit="onEdit"
          @settings="onSettings"
        />
      </template>
    </Table>
    <Pagination
      v-if="schools.paged.value"
      :page="schools.page.value"
      :per-page="PAGE_SIZE"
      :total="schools.total.value"
      @update:page="schools.goTo"
    />
  </section>
</template>
