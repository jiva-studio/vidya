<script setup lang="ts">
import { EmptyState, Skeleton } from '@vidya/ui'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useSiteStatus } from '@/shared/status'
import { useOutboxView } from '@/shared/sync'
import { BackfillProgress, mutedClasses, pageClasses, titleClasses } from '@/shared/ui'

import { pickCourseView, pickLessonsView, useCourseView } from '../model'
import CoursePlace from './CoursePlace.vue'
import LessonRow from './LessonRow.vue'
import { listClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()
const status = useSiteStatus()
const outbox = useOutboxView()

const code = computed(() => String(route.params.code ?? ''))
const courseId = computed(() => String(route.params.courseId ?? ''))

const { course, lessons, place, reading } = useCourseView(
  () => code.value,
  () => courseId.value,
)

const view = computed(() =>
  pickCourseView({
    reading: reading.value,
    found: course.value !== null,
    filled: status.firstRunCompleted.value,
  }),
)

const lessonsView = computed(() =>
  pickLessonsView({ lessons: lessons.value.length, filled: status.firstRunCompleted.value }),
)
</script>

<template>
  <section :class="pageClasses">
    <h1 v-if="course" :class="titleClasses">{{ course.name }}</h1>
    <h1 v-else :class="titleClasses">{{ $t('course-title') }}</h1>

    <Skeleton v-if="view === 'reading'" :lines="3" />

    <BackfillProgress
      v-else-if="view === 'arriving'"
      :rows="status.done.value"
      :running="status.syncing.value"
    />

    <EmptyState
      v-else-if="view === 'absent'"
      :title="$t('course-absent-title')"
      :description="$t('course-absent-text')"
    />

    <template v-else>
      <p v-if="course?.description" :class="mutedClasses">{{ course.description }}</p>

      <CoursePlace
        :status="place?.status ?? null"
        :code="code"
        :course-id="courseId"
        :submission="place ? outbox.state('enrollments', place.id) : undefined"
        :reason="place ? outbox.reason('enrollments', place.id) : undefined"
      />

      <ol v-if="lessonsView === 'lessons'" :class="listClasses">
        <LessonRow
          v-for="row in lessons"
          :key="row.id"
          :row="row"
          :code="code"
          :course-id="courseId"
        />
      </ol>

      <BackfillProgress
        v-else-if="lessonsView === 'arriving'"
        :rows="status.done.value"
        :running="status.syncing.value"
      />

      <p v-else :class="mutedClasses">{{ $t('course-no-lessons') }}</p>
    </template>
  </section>
</template>
