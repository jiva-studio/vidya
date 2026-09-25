<script setup lang="ts">
import type { CourseSummary } from '@vidya/protocol'
import { TableFilters } from '@vidya/ui'
import { onMounted, watch } from 'vue'
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
const { generation, schoolId } = useCurrentSchool()

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

/* ---------------------------------- Hooks --------------------------------- */

// The server answers for the school in hand, so a switch is a new list.
watch(generation, () => {
  courses.restart()
})

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
  void router.push({ name: 'lessons', query: { courseId: id } })
}

function onRetry() {
  void courses.load()
}

function onSearch(term: string) {
  courses.find(term)
}

function onClear() {
  courses.find('')
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
        v-if="courses.searchable.value"
        :search="courses.query.value"
        :search-label="$t('courses-title')"
        :filters-applied="!!courses.query.value"
        @update:search="onSearch"
        @clear="onClear"
      />
    </template>
    <CoursesTable
      :rows="courses.rows.value"
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
