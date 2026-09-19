<script setup lang="ts">
import { Button, PageHeader, TableFilters } from '@vidya/ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useCourses } from '@/entities/course'
import { useCan } from '@/shared/access'

import CoursesTable from './CoursesTable.vue'
import { pageClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const router = useRouter()
const courses = useCourses()
const search = ref('')

// Hidden rather than disabled: a button the operator may never press only
// spends their attention, and the server refuses regardless.
const canCreate = useCan('courses:create')
const canEdit = useCan('courses:update')

const displayedItems = computed(() => {
  if (!search.value.trim()) return courses.items.value
  const query = search.value.trim().toLowerCase()
  return courses.items.value.filter((course) => course.name.toLowerCase().includes(query))
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
  void courses.reload()
}

function onClear() {
  search.value = ''
}
</script>

<template>
  <section :class="pageClasses">
    <PageHeader :title="$t('courses-title')">
      <template #actions>
        <Button v-if="canCreate" @click="onCreate">{{ $t('courses-create') }}</Button>
      </template>
    </PageHeader>
    <TableFilters
      v-if="courses.items.value.length >= 10 || search"
      v-model:search="search"
      :search-label="$t('courses-title')"
      :filters-applied="!!search"
      @clear="onClear"
    />
    <CoursesTable
      :rows="displayedItems"
      :loading="courses.loading.value"
      :error="courses.error.value && $t(courses.error.value)"
      :can-create="canCreate"
      :can-edit="canEdit"
      @retry="onRetry"
      @create="onCreate"
      @edit="onEdit"
      @lessons="onLessons"
    />
  </section>
</template>
