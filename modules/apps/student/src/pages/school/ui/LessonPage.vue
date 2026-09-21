<script setup lang="ts">
import { education } from '@vidya/client'
import type { BlockId, LessonBlockState } from '@vidya/domain'
import type { LessonPreviewLabels, LessonProgress } from '@vidya/ui'
import { EmptyState, LessonPreview, Skeleton } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useBlockStateWriter } from '@/shared/data'
import { useSiteStatus } from '@/shared/status'
import { BackfillProgress, mutedClasses, pageClasses, titleClasses } from '@/shared/ui'

import { pickLessonView, recordBlockState, toBlockStates, useLessonView } from '../model'
import LessonOutdated from './LessonOutdated.vue'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const route = useRoute()
const status = useSiteStatus()
const writer = useBlockStateWriter()

const code = computed(() => String(route.params.code ?? ''))
const courseId = computed(() => String(route.params.courseId ?? ''))
const lessonId = computed(() => String(route.params.lessonId ?? ''))

const { lesson, version, place, states, reading, reload } = useLessonView(
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

// Progress belongs to a place on the course: a student who holds none reads
// the lesson and records nothing, so the copy they are shown carries no
// controls at all rather than controls that would write against nothing.
const progress = computed<LessonProgress | undefined>(() =>
  place.value === null
    ? undefined
    : {
        states: toBlockStates(states.value),
        editable: writer.writable.value,
        labels: {
          markRead: $t('lesson-mark-read'),
          answerRecorded: $t('lesson-answer-recorded'),
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

      <LessonPreview
        :content="version.content"
        :labels="labels"
        :progress="progress"
        @change="onChange"
      />
    </template>
  </section>
</template>
