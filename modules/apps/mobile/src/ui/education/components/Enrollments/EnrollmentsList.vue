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
import type { EnrollmentViewModel } from './EnrollmentViewModel'

/* --------------------------------- Props ---------------------------------- */

defineProps<{ items: EnrollmentViewModel[] }>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<{ click: [enrollmentId: EnrollmentId] }>()

/* -------------------------------- Handlers -------------------------------- */

function onEnrollmentClicked(enrollmentId: EnrollmentId) {
  emit('click', enrollmentId)
}
</script>
