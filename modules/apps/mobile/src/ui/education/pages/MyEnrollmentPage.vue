<template>
  <PageWithHeaderLayout
    :title="title"
    back-href="/education/my-enrollments"
    :busy="busy"
    :has-data="loaded"
  >
    <EnrollmentReviewStatus
      v-if="enrollment && enrollment.status !== 'accepted'"
      :image="statusImage"
      :header="$t(`enrollment-${enrollment.status}`)"
      :text="summary"
      :action-text="$t('my-enrollment-go-back')"
      :danger-action-text="dangerActionText"
      :danger-action-alert="dangerActionAlert"
      @click="onStatusButtonClicked"
    >
      <RevokedEnrollmentNotice v-if="ending" :reason="ending" :course-name="courseName" />
      <IonNote v-if="groupClosed">{{ $t('enrollment-group-closed') }}</IonNote>
      <IonNote v-if="groupDeleted">{{ $t('enrollment-group-deleted') }}</IonNote>
      <EnrollmentRejectionNotice v-if="rejection" :reason="rejection" />
    </EnrollmentReviewStatus>

    <template v-else-if="enrollment">
      <EnrollmentRejectionNotice v-if="rejection" :reason="rejection" />
      <LessonsList :items="lessons" @click="onLessonClicked" />
      <EnrollmentDangerAction v-if="action" :action="action" @confirm="onDangerConfirmed" />
    </template>
  </PageWithHeaderLayout>
</template>

<script lang="ts" setup>
import type { GroupId, LessonId } from '@vidya/domain'
import { IonNote, useIonRouter } from '@ionic/vue'
import { asId, isRecruiting } from '@vidya/domain'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { useOutboxView, useRepositories } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import type { LocalGroup } from '@/ports'
import { useLocalData } from '@/shared'
import {
  actionFor,
  EnrollmentDangerAction,
  EnrollmentRejectionNotice,
  EnrollmentReviewStatus,
  LessonsList,
  useEnrollmentActions,
} from '@/ui/education'
import { type EnrollmentEnding, RevokedEnrollmentNotice } from '@/ui/sync'

import type { MyEnrollmentPageProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<MyEnrollmentPageProps>()

/* --------------------------------- State ---------------------------------- */

const repositories = useRepositories()
const outbox = useOutboxView()
const fluent = useFluent()
const router = useIonRouter()

const readGroup = (id: string | null): Promise<LocalGroup | null> =>
  id === null ? Promise.resolve(null) : repositories.groups.getById(asId<GroupId>(id))

// Lessons belong to the course, not to the group: an accepted student reads
// them while still waiting to be placed.
const { data, busy, loaded, reload } = useLocalData(
  async () => {
    const enrollment = await repositories.enrollments.getById(props.enrollmentId)
    const lessons =
      enrollment?.status === 'accepted'
        ? await repositories.lessons.listByCourse(enrollment.courseId)
        : []

    return {
      enrollment,
      lessons,
      course: enrollment ? await repositories.courses.getById(enrollment.courseId) : null,
      group: await readGroup(enrollment?.groupId ?? null),
      preferredGroup: await readGroup(enrollment?.preferredGroupId ?? null),
    }
  },
  { enrollment: null, lessons: [], course: null, group: null, preferredGroup: null },
  { watching: [() => props.enrollmentId] },
)

// Only these two outcomes have art. A status without its own picture takes
// the one for a refusal rather than a broken image, which is what `revoked`
// rendered before this.
const STATUS_IMAGES = new Set(['pending', 'declined'])

const statusImage = computed(() => {
  const status = data.value.enrollment?.status
  return `enrollment/${status && STATUS_IMAGES.has(status) ? status : 'declined'}.webp`
})

const enrollment = computed(() => data.value.enrollment)
const lessons = computed(() => data.value.lessons)
const courseName = computed(() => data.value.course?.name ?? '')

// The group a student was placed in names the screen; the one they asked for
// does not, because it is a wish and may never be theirs.
const title = computed(() => data.value.group?.name ?? fluent.$t('my-enrollment-title'))

const ending = computed<EnrollmentEnding | undefined>(() => {
  const status = enrollment.value?.status
  return status === 'revoked' || status === 'withdrawn' ? status : undefined
})

// The notice carries the whole explanation for an ending, so the summary
// beside it would say the same thing twice.
const summary = computed(() => {
  const status = enrollment.value?.status
  if (!status || status === 'accepted' || ending.value) return ''

  return fluent.$t(`enrollment-${status}-summary`)
})

const action = computed(() => (enrollment.value ? actionFor(enrollment.value.status) : null))

const dangerActionText = computed(() => (action.value ? fluent.$t(action.value.label) : undefined))

const dangerActionAlert = computed(() =>
  action.value?.confirmation ? fluent.$t(action.value.confirmation) : undefined,
)

// A group that closed while the request was waiting is an answer: the school
// will place the student elsewhere, and that takes longer.
const groupClosed = computed(() => {
  const asked = data.value.preferredGroup
  return enrollment.value?.status === 'pending' && asked !== null && !isRecruiting(asked.status)
})

// The row the student asked for has left the collection: the school deleted
// the group, which is different news from a group that merely stopped taking
// students.
const groupDeleted = computed(
  () =>
    enrollment.value?.status === 'pending' &&
    enrollment.value.preferredGroupId !== null &&
    data.value.preferredGroup === null,
)

const rejection = computed(() =>
  outbox.state('enrollments', props.enrollmentId) === 'rejected'
    ? outbox.reason('enrollments', props.enrollmentId)
    : undefined,
)

const actions = useEnrollmentActions(repositories.enrollments, reload)

/* -------------------------------- Handlers -------------------------------- */

function onStatusButtonClicked(clicked: 'normal' | 'danger') {
  if (clicked === 'normal') router.back()
  else onDangerConfirmed()
}

function onDangerConfirmed() {
  if (action.value) void actions.run(props.enrollmentId, action.value)
}

function onLessonClicked(lessonId: LessonId) {
  router.push({ name: 'lesson', params: { enrollmentId: props.enrollmentId, lessonId } })
}
</script>
