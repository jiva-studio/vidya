<template>
  <EnrollmentsListItem
    v-for="item in items"
    :id="item.id"
    :key="item.id"
    :course-name="item.courseName"
    :group-name="item.groupName"
    :status="item.status"
    :requested-at="item.requestedAt"
    @click="() => onEnrollmentClicked(item.id)"
    @action="(action) => onActionRequested(item.id, action)"
  />
</template>

<script setup lang="ts">
import type { EnrollmentId } from '@vidya/domain'

import type { EnrollmentActionView } from '../../model/enrollmentActions'
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

function onActionRequested(enrollmentId: EnrollmentId, action: EnrollmentActionView) {
  emit('action', enrollmentId, action)
}
</script>
