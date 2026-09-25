<script setup lang="ts">
import type { SelectOption } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useCourses } from '@/entities/course'
import { useCourseLessons, type LessonRow } from '@/entities/lesson'
import { useCan } from '@/shared/access'
import { ListPage } from '@/widgets/list-page'

import AddLessonDialog from './AddLessonDialog.vue'
import LessonsFilters from './LessonsFilters.vue'
import LessonsTable from './LessonsTable.vue'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const route = useRoute()
const router = useRouter()

const initialCourseId = computed(() => String(route.query.courseId ?? route.params.courseId ?? ''))

const courseFilter = ref<string>(initialCourseId.value)
const courses = useCourses()
const lessons = useCourseLessons(courseFilter)

const canCreate = useCan('lessons:create')
const canEdit = useCan('lessons:update')

const adding = ref(false)
const busy = ref(false)

const courseNames = computed(
  () => new Map(courses.items.value.map((course) => [course.id, course.name])),
)

const courseOptions = computed<SelectOption[]>(() =>
  courses.items.value.map((course) => ({ value: course.id, label: course.name })),
)

const filtersApplied = computed(() => !!lessons.query.value || !!courseFilter.value)

const isSearching = computed(() => !!lessons.query.value.trim())

const emptyTitle = computed(() =>
  isSearching.value ? $t('lessons-no-matches-title') : $t('lessons-empty-title'),
)
const emptyDescription = computed(() =>
  isSearching.value ? $t('lessons-no-matches-body') : $t('lessons-empty-body'),
)

watch(
  () => route.query.courseId,
  (next) => {
    if (typeof next === 'string') {
      courseFilter.value = next
    }
  },
)

/* -------------------------------- Handlers -------------------------------- */

function onCreate() {
  adding.value = true
}

function onDialog(open: boolean) {
  adding.value = open
}

async function onAdd(title: string, targetCourseId?: string) {
  busy.value = true
  const added = await lessons.add(title, targetCourseId)
  busy.value = false
  if (added) adding.value = false
}

function onEdit(row: LessonRow) {
  void router.push({
    name: 'lesson-editor',
    params: { courseId: row.courseId, lessonId: row.id },
  })
}

function onRetry() {
  void lessons.reload()
}

function onSearch(term: string) {
  lessons.find(term)
}

function onCourse(courseId: string) {
  courseFilter.value = courseId
}

function onClear() {
  courseFilter.value = ''
  lessons.find('')
}
</script>

<template>
  <ListPage
    :title="$t('lessons-title')"
    :create-label="canCreate ? $t('lessons-add') : undefined"
    @create="onCreate"
  >
    <template #filters>
      <LessonsFilters
        :search="lessons.query.value"
        :course-id="courseFilter"
        :course-options="courseOptions"
        :filters-applied="filtersApplied"
        @update:search="onSearch"
        @update:course-id="onCourse"
        @clear="onClear"
      />
    </template>
    <LessonsTable
      :rows="lessons.rows.value"
      :loading="lessons.loading.value"
      :error="lessons.error.value ? $t('state-error') : undefined"
      :can-create="canCreate"
      :can-edit="canEdit"
      :show-course="!courseFilter"
      :course-names="courseNames"
      :empty-title="emptyTitle"
      :empty-description="emptyDescription"
      @retry="onRetry"
      @create="onCreate"
      @edit="onEdit"
    />
    <AddLessonDialog
      :open="adding"
      :busy="busy"
      :error="lessons.addError.value && $t(lessons.addError.value)"
      :course-id="courseFilter"
      :courses="courses.items.value"
      @update:open="onDialog"
      @submit="onAdd"
    />
  </ListPage>
</template>
