<script setup lang="ts">
import type { SelectOption } from '@vidya/ui'
import { Button, PageHeader, Select, TableFilters } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useCourses } from '@/entities/course'
import { useGroups } from '@/entities/group'
import { useCan } from '@/shared/access'
import { ANY, asFilter } from '@/shared/lib'

import GroupsTable from './GroupsTable.vue'
import { filterClasses, pageClasses } from './styles'
import type { GroupListRow } from './types'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const router = useRouter()
const groups = useGroups()
const courses = useCourses()
const search = ref('')

const canCreate = useCan('groups:create')
const canEdit = useCan('groups:update')

const courseNames = computed(
  () => new Map(courses.items.value.map((course) => [course.id, course.name])),
)

const courseOptions = computed<SelectOption[]>(() => [
  { value: ANY, label: $t('groups-filter-all') },
  ...courses.items.value.map((course) => ({ value: course.id, label: course.name })),
])

// Narrowing by course is the server's job — `GetGroupsQuery` takes one — so the
// select drives the request; the search box only sifts what came back.
const named = computed<GroupListRow[]>(() =>
  groups.items.value.map((group) => ({
    ...group,
    courseName: courseNames.value.get(group.courseId),
  })),
)

const displayedItems = computed(() => {
  if (!search.value.trim()) return named.value
  const query = search.value.trim().toLowerCase()
  return named.value.filter((group) => matches(group, query))
})

const filtersApplied = computed(() => !!search.value || !!groups.courseId.value)

// A list narrowed to nothing is not a school without groups.
const emptyTitle = computed(() =>
  filtersApplied.value ? $t('groups-no-matches-title') : $t('groups-empty-title'),
)
const emptyDescription = computed(() =>
  filtersApplied.value ? $t('groups-no-matches-body') : $t('groups-empty-body'),
)

/* -------------------------------- Handlers -------------------------------- */

function onCreate() {
  void router.push({ name: 'group-create' })
}

function onEdit(id: string) {
  void router.push({ name: 'group-edit', params: { groupId: id } })
}

function onMembers(id: string) {
  void router.push({ name: 'group-members', params: { groupId: id } })
}

function onRetry() {
  void groups.reload()
}

function onCourse(value: string) {
  groups.courseId.value = asFilter(value) ?? ''
}

function onClear() {
  search.value = ''
  groups.courseId.value = ''
}

/* -------------------------------- Helpers --------------------------------- */

function matches(group: GroupListRow, query: string): boolean {
  if (group.name.toLowerCase().includes(query)) return true
  return (group.courseName ?? '').toLowerCase().includes(query)
}
</script>

<template>
  <section :class="pageClasses">
    <PageHeader :title="$t('groups-title')">
      <template #actions>
        <Button v-if="canCreate" @click="onCreate">{{ $t('groups-create') }}</Button>
      </template>
    </PageHeader>
    <TableFilters
      v-model:search="search"
      :search-label="$t('groups-title')"
      :filters-applied="filtersApplied"
      @clear="onClear"
    >
      <template #filters>
        <Select
          :class="filterClasses"
          :model-value="groups.courseId.value || ANY"
          :options="courseOptions"
          :placeholder="$t('groups-filter-all')"
          :aria-label="$t('groups-filter-course')"
          @update:model-value="onCourse"
        />
      </template>
    </TableFilters>
    <GroupsTable
      :rows="displayedItems"
      :empty-title="emptyTitle"
      :empty-description="emptyDescription"
      :loading="groups.loading.value"
      :error="groups.error.value ? $t('state-error') : undefined"
      :can-create="canCreate"
      :can-edit="canEdit"
      @retry="onRetry"
      @create="onCreate"
      @edit="onEdit"
      @members="onMembers"
    />
  </section>
</template>
