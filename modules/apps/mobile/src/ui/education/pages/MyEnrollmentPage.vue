<template>
  <PageWithHeaderLayout :title="$t('my-enrollment-title')" :busy="busy" :has-data="loaded">
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
import type { LessonId } from '@vidya/domain'
import { useIonRouter } from '@ionic/vue'
import { computed } from 'vue'

import { useRepositories } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import { useLocalData } from '@/shared'
import { EnrollmentReviewStatus, LessonsList } from '@/ui/education'

import type { MyEnrollmentPageProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<MyEnrollmentPageProps>()

/* --------------------------------- State ---------------------------------- */

const repositories = useRepositories()
const router = useIonRouter()

// Lessons belong to the course, not to the group: an accepted student reads
// them while still waiting to be placed.
const { data, busy, loaded } = useLocalData(
  async () => {
    const enrollment = await repositories.enrollments.getById(props.enrollmentId)
    const lessons =
      enrollment?.status === 'accepted'
        ? await repositories.lessons.listByCourse(enrollment.courseId)
        : []

    return { enrollment, lessons }
  },
  { enrollment: null, lessons: [] },
  { watching: [() => props.enrollmentId] },
)

const enrollment = computed(() => data.value.enrollment)
const lessons = computed(() => data.value.lessons)

/* -------------------------------- Handlers -------------------------------- */

function onStatusButtonClicked() {
  router.back()
}

function onLessonClicked(lessonId: LessonId) {
  router.push({ name: 'lesson', params: { enrollmentId: props.enrollmentId, lessonId } })
}
</script>
