<script setup lang="ts">
import type { SelectOption } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'

import { useCourses } from '@/entities/course'
import { useGroups } from '@/entities/group'
import { useCan } from '@/shared/access'

import GroupsFilters from './GroupsFilters.vue'
import GroupsTable from './GroupsTable.vue'
import type { GroupListRow } from './types'
import { ListPage } from '@/widgets/list-page'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const router = useRouter()
const groups = useGroups()
const courses = useCourses()

const canCreate = useCan('groups:create')
const canEdit = useCan('groups:update')

const courseNames = computed(
  () => new Map(courses.items.value.map((course) => [course.id, course.name])),
)

const courseOptions = computed<SelectOption[]>(() =>
  courses.items.value.map((course) => ({ value: course.id, label: course.name })),
)

// Narrowing by course is the server's job — `GetGroupsQuery` takes one — so the
// select drives the request; the search box only sifts what came back.
const named = computed<GroupListRow[]>(() =>
  groups.items.value.map((group) => ({
    ...group,
    courseName: courseNames.value.get(group.courseId),
  })),
)

const filtersApplied = computed(() => !!groups.query.value || !!groups.courseId.value)

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

function onSearch(term: string) {
  groups.find(term)
}

function onCourse(value: string) {
  groups.courseId.value = value
}

function onClear() {
  groups.courseId.value = ''
  groups.find('')
}

/* -------------------------------- Helpers --------------------------------- */
</script>

<template>
  <ListPage
    :title="$t('groups-title')"
    :create-label="canCreate ? $t('groups-create') : undefined"
    :page="groups.page.value"
    :total="groups.total.value"
    :paged="groups.paged.value"
    @create="onCreate"
    @update:page="groups.goTo"
  >
    <template #filters>
      <GroupsFilters
        :search="groups.query.value"
        :course-id="groups.courseId.value"
        :course-options="courseOptions"
        :filters-applied="filtersApplied"
        @update:search="onSearch"
        @update:course-id="onCourse"
        @clear="onClear"
      />
    </template>
    <GroupsTable
      :rows="named"
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
  </ListPage>
</template>
