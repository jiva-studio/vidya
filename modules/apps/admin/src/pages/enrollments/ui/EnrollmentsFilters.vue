<script setup lang="ts">
import type { CourseId, EnrollmentStatus, GroupId } from '@vidya/domain'
import { EnrollmentStatuses } from '@vidya/domain'
import type { SelectOption } from '@vidya/ui'
import { FormField, Select } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { enrollmentLabels } from '@/entities/enrollment'
import { ANY, asFilter, asSelected } from '@/shared/lib'

import { filterClasses, filtersClasses } from './styles'
import type { EnrollmentsFiltersEmits, EnrollmentsFiltersProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<EnrollmentsFiltersProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<EnrollmentsFiltersEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const anyOption = computed<SelectOption>(() => ({ value: ANY, label: $t('filter-any') }))

// The states come from the domain, so one added there appears here on its own.
const statusOptions = computed<SelectOption[]>(() => [
  anyOption.value,
  ...EnrollmentStatuses.map((status) => ({ value: status, label: $t(enrollmentLabels[status]) })),
])

const courseChoices = computed<SelectOption[]>(() => [anyOption.value, ...props.courseOptions])
const groupChoices = computed<SelectOption[]>(() => [anyOption.value, ...props.groupOptions])

/* -------------------------------- Handlers -------------------------------- */

function onStatus(value: string) {
  emit('update:filters', { ...props.filters, status: asFilter<EnrollmentStatus>(value) })
}

function onCourse(value: string) {
  const courseId = asFilter<CourseId>(value)
  emit('update:filters', { ...props.filters, courseId, groupId: undefined })
}

function onGroup(value: string) {
  emit('update:filters', { ...props.filters, groupId: asFilter<GroupId>(value) })
}
</script>

<template>
  <div :class="filtersClasses">
    <FormField :class="filterClasses" :label="$t('enrollments-filter-status')">
      <Select
        :model-value="asSelected(props.filters.status)"
        :options="statusOptions"
        :placeholder="$t('filter-any')"
        @update:model-value="onStatus"
      />
    </FormField>
    <FormField :class="filterClasses" :label="$t('enrollments-filter-course')">
      <Select
        :model-value="asSelected(props.filters.courseId)"
        :options="courseChoices"
        :placeholder="$t('filter-any')"
        @update:model-value="onCourse"
      />
    </FormField>
    <FormField :class="filterClasses" :label="$t('enrollments-filter-group')">
      <Select
        :model-value="asSelected(props.filters.groupId)"
        :options="groupChoices"
        :placeholder="$t('filter-any')"
        @update:model-value="onGroup"
      />
    </FormField>
  </div>
</template>
