<template>
  <PageWithHeaderLayout
    :title="$t('lesson-title')"
    :back-href="`/education/my-enrollments/${enrollmentId}`"
    :busy="busy"
    :has-data="loaded"
  >
    <template #toolbar>
      <IonToolbar>
        <LessonSectionsList v-model="selected" :items="sectionViews" />
      </IonToolbar>
    </template>

    <LessonContentGate :content-schema-version="contentSchemaVersion">
      <LessonSectionView
        v-if="selectedSection"
        :blocks="selectedSection.blocks"
        :states="blockStates"
        @change="onBlockStateChanged"
      />

      <SubmittedHomeworkItem
        v-if="submitted"
        :answer-text="submitted.text"
        :state="submissionState"
        :reason="rejectionReason"
        :lesson-title="lessonTitle"
      />

      <HomeworkAnswer
        v-else-if="isAssessed"
        :status="selectedHomework?.status ?? 'open'"
        :answer="selectedHomework?.text"
        @submit="onHomeworkSubmitted"
      />
    </LessonContentGate>
  </PageWithHeaderLayout>
</template>

<script lang="ts" setup>
import type { BlockId, SectionId } from '@vidya/domain'
import { toIsoDateTime } from '@vidya/domain'
import type { LessonBlockState } from '@vidya/protocol'
import { IonToolbar } from '@ionic/vue'
import { computed, ref } from 'vue'

import { useOutboxView, useRepositories } from '@/app'
import { PageWithHeaderLayout } from '@/design'
import type { LocalBlockState, LocalHomework, LocalLesson, LocalLessonVersion } from '@vidya/client'
import { isHomeworkEditable } from '@vidya/client'
import { useLocalData } from '@/shared'
import { HomeworkAnswer, LessonSectionsList, LessonSectionView } from '@/ui/education'
import type { SubmissionState } from '@vidya/client'
import { LessonContentGate, SubmittedHomeworkItem } from '@/ui/sync'
import { education } from '@vidya/client'

import type { LessonPageProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<LessonPageProps>()

/* --------------------------------- State ---------------------------------- */

const repositories = useRepositories()
const outbox = useOutboxView()
const selected = ref(0)

const { data, busy, loaded, reload } = useLocalData(readLesson, emptyLesson(), {
  watching: [() => props.enrollmentId, () => props.lessonId],
})

const lessonTitle = computed(() => data.value.lesson?.title)
const sections = computed(() => data.value.version?.content.sections ?? [])
const selectedSection = computed(() => sections.value[selected.value])
const contentSchemaVersion = computed(() => data.value.version?.content.schemaVersion ?? 1)

// The strip is a row of labels; everything else about a section is read from
// the section itself once it is the selected one.
const sectionViews = computed(() =>
  sections.value.map((section) => ({ id: section.id, title: section.title })),
)

const blockStates = computed(
  () =>
    Object.fromEntries(data.value.states.map((state) => [state.blockId, state.state])) as Record<
      BlockId,
      LessonBlockState
    >,
)

const isAssessed = computed(
  () => selectedSection.value !== undefined && selectedSection.value.assessment !== 'none',
)

const selectedHomework = computed(() =>
  selectedSection.value ? homeworkFor(selectedSection.value.id) : undefined,
)

// Where an answer has got to is part of the answer. Once it has been handed in
// it is no longer a box to type in: it is the work, with the state it is in and
// the school's reason if the school would not take it.
const submitted = computed(() =>
  selectedHomework.value && !isHomeworkEditable(selectedHomework.value.status)
    ? selectedHomework.value
    : undefined,
)

const submissionState = computed<SubmissionState>(() =>
  submitted.value ? outbox.state('homework', submitted.value.id) : 'accepted',
)

const rejectionReason = computed(() =>
  submitted.value ? outbox.reason('homework', submitted.value.id) : undefined,
)

/* -------------------------------- Handlers -------------------------------- */

async function onBlockStateChanged(blockId: BlockId, state: LessonBlockState) {
  const version = data.value.version
  if (!version) return

  const existing = data.value.states.find((item) => item.blockId === blockId)

  await repositories.blockStates.save({
    id: existing?.id ?? education.newBlockStateId(),
    schoolId: version.schoolId,
    enrollmentId: props.enrollmentId,
    lessonVersionId: version.id,
    blockId,
    state,
  })
}

async function onHomeworkSubmitted(text: string) {
  const version = data.value.version
  const section = selectedSection.value
  if (!version || !section) return

  const saved = await repositories.homework.saveAnswer({
    id: selectedHomework.value?.id ?? education.newHomeworkId(),
    schoolId: version.schoolId,
    enrollmentId: props.enrollmentId,
    lessonVersionId: version.id,
    sectionId: section.id,
    text,
  })

  await repositories.homework.submit(saved.id, toIsoDateTime(new Date()))
  await reload()
}

/* -------------------------------- Helpers --------------------------------- */

/** What the page draws before the reads come back, and when a piece is absent. */
interface LessonView {
  lesson: LocalLesson | null
  version: LocalLessonVersion | null
  states: readonly LocalBlockState[]
  homework: readonly LocalHomework[]
}

function emptyLesson(): LessonView {
  return { lesson: null, version: null, states: [], homework: [] }
}

async function readLesson(): Promise<LessonView> {
  const lesson = await repositories.lessons.getById(props.lessonId)
  const version = await repositories.lessonVersions.getPublished(props.lessonId)

  if (version === null) return { ...emptyLesson(), lesson }

  return {
    lesson,
    version,
    states: await repositories.blockStates.listByLessonVersion(props.enrollmentId, version.id),
    homework: await repositories.homework.listByEnrollment(props.enrollmentId),
  }
}

function homeworkFor(sectionId: SectionId) {
  return data.value.homework.find((item) => item.sectionId === sectionId)
}
</script>
