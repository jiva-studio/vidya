<script setup lang="ts">
import type { CourseId, GroupId, HomeworkStatus } from '@vidya/domain'
import { HomeworkStatuses } from '@vidya/domain'
import type { SelectOption } from '@vidya/ui'
import { FormField, Select } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { homeworkLabels } from '@/entities/homework'

import { filterClasses, filtersClasses } from './styles'
import type { HomeworkQueueFiltersEmits, HomeworkQueueFiltersProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<HomeworkQueueFiltersProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<HomeworkQueueFiltersEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

// The states come from the domain, so one added there appears here on its own.
const statusOptions = computed<SelectOption[]>(() =>
  HomeworkStatuses.map((status) => ({ value: status, label: $t(homeworkLabels[status]) })),
)

/* -------------------------------- Handlers -------------------------------- */

function onStatus(value: string) {
  emit('update:filters', { ...props.filters, status: (value || undefined) as HomeworkStatus })
}

function onCourse(value: string) {
  const courseId = (value || undefined) as CourseId
  emit('update:filters', { ...props.filters, courseId, groupId: undefined })
}

function onGroup(value: string) {
  emit('update:filters', { ...props.filters, groupId: (value || undefined) as GroupId })
}
</script>

<template>
  <div :class="filtersClasses">
    <FormField :class="filterClasses" :label="$t('homework-filter-status')">
      <Select
        :model-value="props.filters.status ?? ''"
        :options="statusOptions"
        :placeholder="$t('filter-any')"
        @update:model-value="onStatus"
      />
    </FormField>
    <FormField :class="filterClasses" :label="$t('homework-filter-course')">
      <Select
        :model-value="props.filters.courseId ?? ''"
        :options="props.courseOptions"
        :placeholder="$t('filter-any')"
        @update:model-value="onCourse"
      />
    </FormField>
    <FormField :class="filterClasses" :label="$t('homework-filter-group')">
      <Select
        :model-value="props.filters.groupId ?? ''"
        :options="props.groupOptions"
        :placeholder="$t('filter-any')"
        @update:model-value="onGroup"
      />
    </FormField>
  </div>
</template>
