<script setup lang="ts">
import { TableFilters, type SelectOption } from '@vidya/ui'
import { useFluent } from 'fluent-vue'

import LessonsCourseFilter from './LessonsCourseFilter.vue'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<{
  search: string
  courseId: string
  courseOptions: SelectOption[]
  filtersApplied: boolean
}>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<{
  'update:search': [term: string]
  'update:courseId': [courseId: string]
  clear: []
}>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

/* -------------------------------- Handlers -------------------------------- */

function onSearch(term: string) {
  emit('update:search', term)
}

function onCourse(courseId: string) {
  emit('update:courseId', courseId)
}

function onClear() {
  emit('clear')
}
</script>

<template>
  <TableFilters
    :search="props.search"
    :search-label="$t('lessons-title')"
    :filters-applied="props.filtersApplied"
    @update:search="onSearch"
    @clear="onClear"
  >
    <template #filters>
      <LessonsCourseFilter
        :model-value="props.courseId"
        :options="props.courseOptions"
        @update:model-value="onCourse"
      />
    </template>
  </TableFilters>
</template>
