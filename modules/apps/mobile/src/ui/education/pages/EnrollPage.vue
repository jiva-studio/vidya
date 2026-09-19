<template>
  <PageWithHeaderLayout
    :title="$t('enroll-title')"
    :has-padding="true"
    :has-data="true"
    :error="error"
  >
    <h2>{{ $t('enroll-title') }}</h2>
    <p>{{ $t('enroll-moderated') }}</p>

    <AsyncButton :busy="busy" expand="block" @click="onEnrollButtonClicked">
      {{ $t('enroll-title') }}
    </AsyncButton>
  </PageWithHeaderLayout>
</template>

<script setup lang="ts">
import { useIonRouter } from '@ionic/vue'
import { useFluent } from 'fluent-vue'
import { ref } from 'vue'

import { useRepositories } from '@/app'
import { AsyncButton, PageWithHeaderLayout } from '@/design'
import { education } from '@/usecases'

import type { EnrollPageProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<EnrollPageProps>()

/* --------------------------------- State ---------------------------------- */

const repositories = useRepositories()
const router = useIonRouter()
const fluent = useFluent()
const busy = ref(false)
const error = ref<string | undefined>(undefined)

/* -------------------------------- Handlers -------------------------------- */

// Enrolment is a request, not a booking: the school decides, and it assigns the
// group afterwards. Nothing leaves the device here — the request is written
// down and journaled, so it reaches the school on the next run and survives
// having been made with no connection at all.
async function onEnrollButtonClicked() {
  busy.value = true
  error.value = undefined
  try {
    await writeRequest()
    router.navigate({ name: 'enroll-completed', params: { id: props.courseId } }, 'none', 'pop')
  } catch {
    error.value = fluent.$t('enroll-failed')
  } finally {
    busy.value = false
  }
}

/* -------------------------------- Helpers --------------------------------- */

async function writeRequest() {
  const course = await repositories.courses.getById(props.courseId)
  if (course === null) throw new Error(`no local course with id ${props.courseId}`)

  await education.requestEnrollmentLocally(repositories.enrollments, {
    id: education.newEnrollmentId(),
    schoolId: course.schoolId,
    courseId: course.id,
  })
}
</script>
