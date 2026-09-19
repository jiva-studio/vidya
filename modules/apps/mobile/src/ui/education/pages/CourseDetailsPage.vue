<template>
  <PageWithHeaderLayout
    :title="course?.name ?? ''"
    :busy="busy"
    :has-data="loaded"
    :has-padding="true"
  >
    <p v-if="course?.description">{{ course.description }}</p>

    <IonButton v-if="enrollment" expand="block" @click="onOpenEnrollmentClicked">
      {{ $t('course-open-enrollment') }}
    </IonButton>

    <IonButton v-else expand="block" @click="onEnrollButtonClicked">
      {{ $t('course-enroll') }}
    </IonButton>
  </PageWithHeaderLayout>
</template>

<script setup lang="ts">
import { IonButton, useIonRouter } from '@ionic/vue'
import { computed } from 'vue'

import { useRepositories } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import { useLocalData } from '@/shared'

import type { CourseDetailsPageProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<CourseDetailsPageProps>()

/* --------------------------------- State ---------------------------------- */

const repositories = useRepositories()
const router = useIonRouter()

// The place the student already holds is read beside the course, because a
// screen that offers to enrol someone who is already enrolled is offering a
// second request — and one course holds one place, so the second would never
// become one.
const { data, busy, loaded } = useLocalData(
  async () => ({
    course: await repositories.courses.getById(props.id),
    enrollment: await repositories.enrollments.getByCourse(props.id),
  }),
  { course: null, enrollment: null },
  { watching: [() => props.id] },
)

const course = computed(() => data.value.course)
const enrollment = computed(() => data.value.enrollment)

/* -------------------------------- Handlers -------------------------------- */

function onEnrollButtonClicked() {
  router.push({ name: 'enroll', params: { id: props.id } })
}

function onOpenEnrollmentClicked() {
  const held = enrollment.value
  if (held === null) return

  router.push({ name: 'my-enrollment', params: { id: held.id } })
}
</script>
