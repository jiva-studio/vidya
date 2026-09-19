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
//
// The guard is the first statement rather than a state of the button: a second
// tap lands before the render that disables it, and the second one would ask
// again under an id of its own.
async function onEnrollButtonClicked() {
  if (busy.value) return

  busy.value = true
  error.value = undefined
  try {
    const held = await repositories.enrollments.getByCourse(props.courseId)
    if (held !== null) {
      router.navigate({ name: 'my-enrollment', params: { id: held.id } }, 'none', 'pop')
      return
    }

    await writeRequest()
    router.navigate({ name: 'enroll-completed', params: { id: props.courseId } }, 'none', 'pop')
  } catch {
    error.value = fluent.$t('enroll-failed')
  } finally {
    busy.value = false
  }
}

/* -------------------------------- Helpers --------------------------------- */

/**
 * Write the request, once.
 *
 * One place per course is the rule on both sides. The server keys a place by
 * `(courseId, studentId)`, so a second document could never become a second
 * place there — it would be recognised as the same request under another name
 * and leave a journal row saying nothing. On the device it would do real harm
 * in the meantime: `getByCourse` answers with the newest row, so a fresh
 * `pending` would hide an accepted place and tell a student who is already
 * studying that they are waiting to be let in.
 *
 * A withdrawn request is not in the way: it is tombstoned, and the reads skip
 * tombstones, so asking again writes a new request as it should.
 */
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
