<script setup lang="ts">
import type { SchoolId } from '@vidya/domain'
import type { TableColumn, TableRowData } from '@vidya/ui'
import { Button, PageHeader, Table } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import type { SchoolRow } from '@/entities/school'
import { useSchools } from '@/entities/school'
import { useCan } from '@/shared/access'

import SchoolsTableRow from './SchoolsTableRow.vue'
import { sectionClasses } from './styles'

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
  { key: 'actions', label: $t('schools-column-actions'), align: 'end' },
])

const errorText = computed(() => (schools.error.value ? $t(schools.error.value) : undefined))
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

function onSettings(id: SchoolId) {
  void router.push({ name: 'school-settings', params: { id } })
}

function onRetry() {
  void schools.load()
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
      <template #actions>
        <Button v-if="canCreate" @click="onCreate">{{ $t('schools-create') }}</Button>
      </template>
    </PageHeader>
    <Table
      :columns="columns"
      :rows="schools.rows.value"
      :loading="schools.loading.value"
      :error="errorText"
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
  </section>
</template>
