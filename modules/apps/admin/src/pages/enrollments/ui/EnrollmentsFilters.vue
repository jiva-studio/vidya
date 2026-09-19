<script setup lang="ts">
import type { CourseId, EnrollmentStatus, GroupId } from '@vidya/domain'
import { EnrollmentStatuses } from '@vidya/domain'
import type { SelectOption } from '@vidya/ui'
import { FormField, Select } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { enrollmentLabels } from '@/entities/enrollment'

import { filterClasses, filtersClasses } from './styles'
import type { EnrollmentsFiltersEmits, EnrollmentsFiltersProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<EnrollmentsFiltersProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<EnrollmentsFiltersEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

// The states come from the domain, so one added there appears here on its own.
const statusOptions = computed<SelectOption[]>(() =>
  EnrollmentStatuses.map((status) => ({ value: status, label: $t(enrollmentLabels[status]) })),
)

/* -------------------------------- Handlers -------------------------------- */

function onStatus(value: string) {
  emit('update:filters', { ...props.filters, status: (value || undefined) as EnrollmentStatus })
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
    <FormField :class="filterClasses" :label="$t('enrollments-filter-status')">
      <Select
        :model-value="props.filters.status ?? ''"
        :options="statusOptions"
        :placeholder="$t('filter-any')"
        @update:model-value="onStatus"
      />
    </FormField>
    <FormField :class="filterClasses" :label="$t('enrollments-filter-course')">
      <Select
        :model-value="props.filters.courseId ?? ''"
        :options="props.courseOptions"
        :placeholder="$t('filter-any')"
        @update:model-value="onCourse"
      />
    </FormField>
    <FormField :class="filterClasses" :label="$t('enrollments-filter-group')">
      <Select
        :model-value="props.filters.groupId ?? ''"
        :options="props.groupOptions"
        :placeholder="$t('filter-any')"
        @update:model-value="onGroup"
      />
    </FormField>
  </div>
</template>
