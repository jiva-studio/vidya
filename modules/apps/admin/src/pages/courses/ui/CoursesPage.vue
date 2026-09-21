<script setup lang="ts">
import type { CourseSummary } from '@vidya/protocol'
import { TableFilters } from '@vidya/ui'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

import { getCourses } from '@/entities/course'
import { useCan, useCurrentSchool } from '@/shared/access'
import { useHttp } from '@/shared/api'
import { usePagedList } from '@/shared/lib'

import CoursesTable from './CoursesTable.vue'
import { ListPage } from '@/widgets/list-page'

/* --------------------------------- State ---------------------------------- */

const router = useRouter()
const http = useHttp()
const { schoolId } = useCurrentSchool()
const search = ref('')

// The page is its own list rather than `useCourses`, which the group form and
// the groups filter read whole: a picker cut to its first page loses courses.
const courses = usePagedList<CourseSummary>({
  read: (page) => getCourses(http, { schoolId: schoolId.value, ...page }),
  fallback: 'courses-load-failed',
})

// Hidden rather than disabled: a button the operator may never press only
// spends their attention, and the server refuses regardless.
const canCreate = useCan('courses:create')
const canEdit = useCan('courses:update')

const displayedItems = computed(() => {
  if (!search.value.trim()) return courses.rows.value
  const query = search.value.trim().toLowerCase()
  return courses.rows.value.filter((course) => course.name.toLowerCase().includes(query))
})

/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void courses.load()
})

/* -------------------------------- Handlers -------------------------------- */

function onCreate() {
  void router.push({ name: 'course-create' })
}

function onEdit(id: string) {
  void router.push({ name: 'course-edit', params: { courseId: id } })
}

function onLessons(id: string) {
  void router.push({ name: 'lessons', params: { courseId: id } })
}

function onRetry() {
  void courses.load()
}

function onClear() {
  search.value = ''
}
</script>

<template>
  <ListPage
    :title="$t('courses-title')"
    :create-label="canCreate ? $t('courses-create') : undefined"
    :page="courses.page.value"
    :total="courses.total.value"
    :paged="courses.paged.value"
    @create="onCreate"
    @update:page="courses.goTo"
  >
    <template #filters>
      <TableFilters
        v-if="courses.rows.value.length >= 10 || search"
        v-model:search="search"
        :search-label="$t('courses-title')"
        :filters-applied="!!search"
        @clear="onClear"
      />
    </template>
    <CoursesTable
      :rows="displayedItems"
      :loading="courses.loading.value"
      :error="courses.error.value ? $t('state-error') : undefined"
      :can-create="canCreate"
      :can-edit="canEdit"
      @retry="onRetry"
      @create="onCreate"
      @edit="onEdit"
      @lessons="onLessons"
    />
  </ListPage>
</template>
