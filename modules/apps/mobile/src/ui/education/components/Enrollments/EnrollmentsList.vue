<template>
  <EnrollmentsListItem
    v-for="item in items"
    :id="item.enrollment.id"
    :key="item.enrollment.id"
    :course-name="item.course.name"
    :group-name="item.group?.name"
    :status="item.enrollment.status"
    @click="() => onEnrollmentClicked(item.enrollment.id)"
  />
</template>

<script setup lang="ts">
import type { EnrollmentId } from '@vidya/domain'

import EnrollmentsListItem from './EnrollmentsListItem.vue'
import type { EnrollmentsListEmits, EnrollmentsListProps } from './types'

/* --------------------------------- Props ---------------------------------- */

defineProps<EnrollmentsListProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<EnrollmentsListEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onEnrollmentClicked(enrollmentId: EnrollmentId) {
  emit('click', enrollmentId)
}
</script>
