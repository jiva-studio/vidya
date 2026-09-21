<script setup lang="ts">
import { education } from '@vidya/client'
import type { BlockId, LessonBlockState, LessonSection, SectionId } from '@vidya/domain'
import { toIsoDateTime } from '@vidya/domain'
import type { LessonPreviewLabels, LessonProgress } from '@vidya/ui'
import { EmptyState, Skeleton } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useBlockStateWriter, useHomeworkWriter } from '@/shared/data'
import { useSiteStatus } from '@/shared/status'
import { useOutboxView } from '@/shared/sync'
import { BackfillProgress, mutedClasses, pageClasses, titleClasses } from '@/shared/ui'

import {
  pickLessonView,
  recordBlockState,
  recordHomeworkAnswer,
  toBlockStates,
  toSectionAnswers,
  toVerdicts,
  useLessonView,
} from '../model'
import LessonBody from './LessonBody.vue'
import LessonOutdated from './LessonOutdated.vue'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const route = useRoute()
const status = useSiteStatus()
const writer = useBlockStateWriter()
const answers = useHomeworkWriter()
const outbox = useOutboxView()

const code = computed(() => String(route.params.code ?? ''))
const courseId = computed(() => String(route.params.courseId ?? ''))
const lessonId = computed(() => String(route.params.lessonId ?? ''))

const {
  lesson,
  version,
  place,
  states,
  answers: written,
  reading,
  reload,
} = useLessonView(
  () => code.value,
  () => courseId.value,
  () => lessonId.value,
)

const view = computed(() =>
  pickLessonView({
    reading: reading.value,
    held: version.value !== null,
    filled: status.firstRunCompleted.value,
    schemaVersion: version.value?.content.schemaVersion ?? 0,
  }),
)

const labels = computed<LessonPreviewLabels>(() => ({
  untitledSection: $t('lesson-untitled-section'),
  embeddedMedia: $t('lesson-embedded-media'),
  missingMedia: $t('lesson-missing-media'),
  emptyQuestion: $t('lesson-empty-question'),
  describeUnknownBlock: (type: string) => $t('lesson-unknown-block', { type }),
}))

const bySection = computed(() => toSectionAnswers(written.value))

const answerFor = (section: LessonSection) => bySection.value[section.id as SectionId] ?? null

// Progress belongs to a place on the course: a student who holds none reads
// the lesson and records nothing, so the copy they are shown carries no
// controls at all rather than controls that would write against nothing.
const progress = computed<LessonProgress | undefined>(() =>
  place.value === null
    ? undefined
    : {
        states: toBlockStates(states.value),
        verdicts: toVerdicts(states.value),
        editable: writer.writable.value,
        labels: {
          markRead: $t('lesson-mark-read'),
          answerRecorded: $t('lesson-answer-recorded'),
          answerCorrect: $t('lesson-answer-correct'),
          answerIncorrect: $t('lesson-answer-incorrect'),
        },
      },
)

/* -------------------------------- Handlers -------------------------------- */

async function onChange(blockId: BlockId, state: LessonBlockState) {
  const held = version.value
  if (held === null || place.value === null) return

  await writer.save(
    recordBlockState({
      version: held,
      enrollmentId: place.value.id,
      states: states.value,
      blockId,
      state,
      mintId: education.newBlockStateId,
    }),
  )

  await reload()
}

async function onSaveAnswer(section: LessonSection, text: string) {
  const held = version.value
  if (held === null || place.value === null) return

  await answers.saveAnswer(
    recordHomeworkAnswer({
      version: held,
      enrollmentId: place.value.id,
      sectionId: section.id,
      answer: answerFor(section),
      text,
      mintId: education.newHomeworkId,
    }),
  )

  outbox.refresh()
  await reload()
}

// Handing in follows the save that the screen emits with it, so the text that
// leaves is the text on screen rather than the one last written.
async function onHandAnswer(section: LessonSection) {
  const answer = answerFor(section)
  if (answer === null) return

  await answers.submitAnswer(answer.id, toIsoDateTime(new Date()))

  outbox.refresh()
  await reload()
}

function onReload() {
  window.location.reload()
}
</script>

<template>
  <section :class="pageClasses">
    <h1 v-if="lesson" :class="titleClasses">{{ lesson.title }}</h1>
    <h1 v-else :class="titleClasses">{{ $t('lesson-title') }}</h1>

    <Skeleton v-if="view === 'reading'" :lines="3" />

    <BackfillProgress
      v-else-if="view === 'arriving'"
      :rows="status.done.value"
      :running="status.syncing.value"
    />

    <EmptyState
      v-else-if="view === 'absent'"
      :title="$t('lesson-absent-title')"
      :description="$t('lesson-absent-text')"
    />

    <LessonOutdated v-else-if="view === 'outdated'" @reload="onReload" />

    <template v-else-if="version">
      <p v-if="progress && !writer.writable.value" :class="mutedClasses">
        {{ $t('lesson-read-only') }}
      </p>
      <p v-else-if="!progress" :class="mutedClasses">{{ $t('lesson-no-place') }}</p>

      <LessonBody
        :content="version.content"
        :labels="labels"
        :progress="progress"
        :answers="bySection"
        :answerable="place !== null"
        :writable="answers.writable.value"
        @change="onChange"
        @save="onSaveAnswer"
        @hand="onHandAnswer"
      />
    </template>
  </section>
</template>
