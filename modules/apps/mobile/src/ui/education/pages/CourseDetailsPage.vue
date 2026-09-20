<template>
  <PageWithHeaderLayout
    :title="course?.name ?? ''"
    :busy="busy"
    :has-data="loaded"
    :has-padding="true"
  >
    <p v-if="course?.description">{{ course.description }}</p>

    <WithListHeader v-if="groups.length > 0" :title="$t('course-groups-title')">
      <GroupsList :items="groups" />
    </WithListHeader>

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
import { PageWithHeaderLayout, WithListHeader } from '@/design'
import { useLocalData } from '@/shared'

import { GroupsList } from '../components/Groups'
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
//
// The groups are the ones still taking students, as the repository answers it:
// the catalogue shows what a student could ask to join, and choosing is done
// on the request itself.
const { data, busy, loaded } = useLocalData(
  async () => {
    const course = await repositories.courses.getById(props.id)
    const groups =
      course?.learningType === 'group'
        ? await repositories.groups.listRecruitingByCourse(props.id)
        : []

    return {
      course,
      groups,
      enrollment: await repositories.enrollments.getLiveByCourse(props.id),
    }
  },
  { course: null, groups: [], enrollment: null },
  { watching: [() => props.id] },
)

const course = computed(() => data.value.course)
const groups = computed(() => data.value.groups)
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
