<template>
  <PageWithHeaderLayout
    :title="$t('enroll-title')"
    :has-padding="true"
    :has-data="true"
    :error="error"
  >
    <p>{{ $t('enroll-moderated') }}</p>

    <WithListHeader v-if="showsGroups" :title="$t('enroll-group-title')">
      <IonNote class="hint">{{ $t('enroll-group-hint') }}</IonNote>
      <GroupSelector v-model="preferredGroupId" :groups="groups" />
    </WithListHeader>

    <WithListHeader :title="$t('enroll-time-title')">
      <IonNote class="hint">{{ $t('enroll-time-hint') }}</IonNote>
      <TimeRangeSelector v-model="ranges" />
    </WithListHeader>

    <WithListHeader :title="$t('enroll-comment-title')">
      <IonTextarea
        v-model="comment"
        :auto-grow="true"
        :label="$t('enroll-comment-label')"
        label-placement="stacked"
      />
    </WithListHeader>

    <AsyncButton :busy="busy" expand="block" @click="onEnrollButtonClicked">
      {{ $t('enroll-title') }}
    </AsyncButton>
  </PageWithHeaderLayout>
</template>

<script setup lang="ts">
import { IonNote, IonTextarea, useIonRouter } from '@ionic/vue'
import type { GroupId, TimeRange } from '@vidya/domain'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import { useRepositories } from '@/app'
import { AsyncButton, PageWithHeaderLayout, WithListHeader } from '@/design'
import { useLocalData } from '@/shared'
import { education } from '@vidya/client'

import { TimeRangeSelector } from '../components/TimeRange'
import GroupSelector from '../containers/GroupSelector.vue'
import type { EnrollPageProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<EnrollPageProps>()

/* --------------------------------- State ---------------------------------- */

const repositories = useRepositories()
const router = useIonRouter()
const fluent = useFluent()
const busy = ref(false)
const error = ref<string | undefined>(undefined)

// What the student asks for: three answers, each standing on its own. None of
// them gates the others, and none of them gates the button.
const preferredGroupId = ref<GroupId | null>(null)
const ranges = ref<readonly TimeRange[]>([])
const comment = ref('')

// Groups are the school's answer to "who is taking students", and only a
// course taught in groups has one.
const { data } = useLocalData(
  async () => {
    const course = await repositories.courses.getById(props.courseId)
    const groups =
      course?.learningType === 'group'
        ? await repositories.groups.listRecruitingByCourse(props.courseId)
        : []

    return { course, groups }
  },
  { course: null, groups: [] },
  { watching: [() => props.courseId] },
)

const groups = computed(() => data.value.groups)
const showsGroups = computed(() => data.value.course?.learningType === 'group')

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
    const held = await repositories.enrollments.getLiveByCourse(props.courseId)
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
 * in the meantime: a second live request for the same course would hide the
 * accepted place and tell a student who is already studying that they are
 * waiting to be let in.
 *
 * A request that ended is not in the way: `getLiveByCourse` passes over it, so
 * asking again writes a new request as it should.
 */
async function writeRequest() {
  const course = await repositories.courses.getById(props.courseId)
  if (course === null) throw new Error(`no local course with id ${props.courseId}`)

  const written = comment.value.trim()

  await education.requestEnrollmentLocally(repositories.enrollments, {
    id: education.newEnrollmentId(),
    schoolId: course.schoolId,
    courseId: course.id,
    preferredGroupId: preferredGroupId.value ?? undefined,
    preferredTimes:
      education.buildPreferredTimes(ranges.value, education.readTimeZone()) ?? undefined,
    comment: written === '' ? undefined : written,
  })
}
</script>

<style scoped>
.hint {
  display: block;
  padding: 0 1rem 0.5rem;
}
</style>
