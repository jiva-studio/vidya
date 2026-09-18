<template>
  <PageWithHeaderLayout
    :title="$t('my-enrollments-title')"
    :busy="busy"
    :has-data="loaded"
    :is-empty="items.length === 0"
    :empty-text="$t('my-enrollments-empty')"
    :error="errorMessage"
  >
    <EnrollmentsList :items="items" @click="onEnrollmentClicked" />
  </PageWithHeaderLayout>
</template>

<script setup lang="ts">
import type { CourseId, EnrollmentId } from '@vidya/domain'
import type { CourseSummary, EnrollmentSummary } from '@vidya/protocol'
import { useIonRouter } from '@ionic/vue'
import { computed } from 'vue'

import { useApi } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import { useFailureMessage, useRemoteData } from '@/shared'
import { EnrollmentsList } from '@/ui/education'
import { education } from '@/usecases'

/* --------------------------------- State ---------------------------------- */

const api = useApi()
const router = useIonRouter()

// An enrolment carries a course id, not a course name, so the catalogue is
// fetched alongside it and the two are joined here.
const { data, busy, loaded, failure } = useRemoteData(async () => {
  const [enrollments, courses] = await Promise.all([
    education.listMyEnrollments(api),
    education.listCourses(api),
  ])
  return { enrollments, courses }
}, undefined)

const errorMessage = useFailureMessage(failure)

const items = computed(() => (data.value?.enrollments ?? []).map(withCourse))

/* -------------------------------- Handlers -------------------------------- */

function onEnrollmentClicked(enrollmentId: EnrollmentId) {
  router.push({ name: 'my-enrollment', params: { id: enrollmentId } })
}

/* -------------------------------- Helpers --------------------------------- */

const UNKNOWN_COURSE = (id: CourseId): CourseSummary => ({ id, name: '' })

function withCourse(enrollment: EnrollmentSummary) {
  const course = data.value?.courses.find((c) => c.id === enrollment.courseId)
  return { enrollment, course: course ?? UNKNOWN_COURSE(enrollment.courseId) }
}
</script>
