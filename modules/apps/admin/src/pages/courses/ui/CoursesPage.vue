<script setup lang="ts">
import { Button, PageHeader } from '@vidya/ui'
import { useRouter } from 'vue-router'

import { useCourses } from '@/entities/course'
import { useCan } from '@/shared/access'

import CoursesTable from './CoursesTable.vue'
import { pageClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const router = useRouter()
const courses = useCourses()

// Hidden rather than disabled: a button the operator may never press only
// spends their attention, and the server refuses regardless (AC-7).
const canCreate = useCan('courses:create')
const canEdit = useCan('courses:update')

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
</script>

<template>
  <section :class="pageClasses">
    <PageHeader :title="$t('courses-title')">
      <template #actions>
        <Button v-if="canCreate" @click="onCreate">{{ $t('courses-create') }}</Button>
      </template>
    </PageHeader>
    <CoursesTable
      :rows="courses.items.value"
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
