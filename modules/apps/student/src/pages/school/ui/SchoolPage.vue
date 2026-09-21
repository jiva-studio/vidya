<script setup lang="ts">
import { EmptyState, Skeleton } from '@vidya/ui'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useSiteStatus } from '@/shared/status'
import { BackfillProgress, pageClasses, titleClasses } from '@/shared/ui'

import { pickCatalogueView, useSchoolCatalogue } from '../model'
import CourseCard from './CourseCard.vue'
import { listClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()
const status = useSiteStatus()

// The public code of the school, never its identifier: this address is printed
// on paper and read aloud, and the guard refuses anything that is not a code.
const code = computed(() => String(route.params.code ?? ''))

const { school, courses, reading } = useSchoolCatalogue(() => code.value)

const view = computed(() =>
  pickCatalogueView({
    reading: reading.value,
    found: school.value !== null,
    courses: courses.value.length,
    filled: status.firstRunCompleted.value,
  }),
)
</script>

<template>
  <section :class="pageClasses">
    <h1 v-if="school" :class="titleClasses">{{ school.name }}</h1>
    <h1 v-else :class="titleClasses">{{ $t('school-title', { code }) }}</h1>

    <Skeleton v-if="view === 'reading'" :lines="3" />

    <BackfillProgress v-else-if="view === 'arriving'" :running="status.syncing.value" />

    <EmptyState
      v-else-if="view === 'absent'"
      :title="$t('school-absent-title')"
      :description="$t('school-absent-text')"
    />

    <EmptyState
      v-else-if="view === 'empty'"
      :title="$t('school-nothing-title')"
      :description="$t('school-nothing-text')"
    />

    <div v-else :class="listClasses">
      <CourseCard v-for="course in courses" :key="course.id" :course="course" :code="code" />
    </div>
  </section>
</template>
