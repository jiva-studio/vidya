<template>
  <PageWithHeaderLayout
    :title="$t('my-enrollment-title')"
    :busy="busy"
    :has-data="loaded"
    :error="errorMessage"
  >
    <EnrollmentReviewStatus
      v-if="enrollment && enrollment.status !== 'accepted'"
      :image="`enrollment/${enrollment.status}.webp`"
      :header="$t(`enrollment-${enrollment.status}`)"
      :text="$t(`enrollment-${enrollment.status}-summary`)"
      :action-text="$t('my-enrollment-go-back')"
      @click="onStatusButtonClicked"
    />

    <LessonsList v-else-if="enrollment" :items="lessons" @click="onLessonClicked" />
  </PageWithHeaderLayout>
</template>

<script lang="ts" setup>
import type { EnrollmentId, LessonId } from '@vidya/domain'
import { useIonRouter } from '@ionic/vue'
import { computed } from 'vue'

import { useApi } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import { useFailureMessage, useRemoteData } from '@/shared'
import { EnrollmentReviewStatus, LessonsList } from '@/ui/education'
import { education } from '@/usecases'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<{ enrollmentId: EnrollmentId }>()

/* --------------------------------- State ---------------------------------- */

const api = useApi()
const router = useIonRouter()

// Lessons belong to the course, not to the group: an accepted student reads
// them while still waiting to be placed.
const { data, busy, loaded, failure } = useRemoteData(async () => {
  const enrollment = await education.getEnrollment(api, props.enrollmentId)
  const lessons =
    enrollment.status === 'accepted'
      ? await education.listLessonsOfCourse(api, enrollment.courseId)
      : []
  return { enrollment, lessons }
}, undefined)

const errorMessage = useFailureMessage(failure)

const enrollment = computed(() => data.value?.enrollment)
const lessons = computed(() => data.value?.lessons ?? [])

/* -------------------------------- Handlers -------------------------------- */

function onStatusButtonClicked() {
  router.back()
}

function onLessonClicked(lessonId: LessonId) {
  router.push({ name: 'lesson', params: { enrollmentId: props.enrollmentId, lessonId } })
}
</script>
