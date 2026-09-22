<script setup lang="ts">
import { TableFilters } from '@vidya/ui'
import { useFluent } from 'fluent-vue'

import GroupsCourseFilter from './GroupsCourseFilter.vue'
import type { GroupsFiltersEmits, GroupsFiltersProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<GroupsFiltersProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<GroupsFiltersEmits>()

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
    :search-label="$t('groups-title')"
    :filters-applied="props.filtersApplied"
    @update:search="onSearch"
    @clear="onClear"
  >
    <template #filters>
      <GroupsCourseFilter
        :model-value="props.courseId"
        :options="props.courseOptions"
        @update:model-value="onCourse"
      />
    </template>
  </TableFilters>
</template>
