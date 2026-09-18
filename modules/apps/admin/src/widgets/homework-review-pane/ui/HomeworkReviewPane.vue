<script setup lang="ts">
import type { HomeworkId } from '@vidya/domain'
import { Card, ErrorState } from '@vidya/ui'
import { computed, onMounted, ref, watch } from 'vue'

import type { HomeworkFilters, HomeworkRow } from '@/entities/homework'
import { ReviewActions, useGradeHomework } from '@/features/grade-homework'
import { useCan } from '@/shared/access'

import { useAnsweredLesson, useCurrentWork, useQueueKeyboard, useQueueRows } from '../model'
import type { HomeworkReviewPaneProps } from '../types'
import HomeworkAnswer from './HomeworkAnswer.vue'
import HomeworkQueueTable from './HomeworkQueueTable.vue'
import QueueFilters from './QueueFilters.vue'
import { columnsClasses, paneClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<HomeworkReviewPaneProps>(), { initialId: undefined })

/* --------------------------------- State ---------------------------------- */

const queue = useQueueRows()
const current = useCurrentWork(queue.rows)
const grading = useGradeHomework()
const answered = useAnsweredLesson()
const canGrade = useCan('homework:grade')

const grade = ref<number | undefined>(undefined)
const confirming = ref(false)

const selectedRow = computed<HomeworkRow | undefined>(() =>
  queue.rows.value.find((row) => row.id === current.selectedId.value),
)

/* ---------------------------------- Hooks --------------------------------- */

onMounted(async () => {
  if (props.initialId) current.select(props.initialId)
  await queue.load()
})

watch(current.work, (opened) => {
  grade.value = opened?.grade
  confirming.value = false
  void resolveAnsweredLesson(opened?.answeredSupersededVersion)
})

useQueueKeyboard({
  next: () => current.move(1),
  previous: () => current.move(-1),
  accept: () => void onAccept(),
  returnWork: () => onReturnAsked(),
})

/* -------------------------------- Handlers -------------------------------- */

// Only for a work whose version has been replaced: everyone else's answer is
// the version on the shelf, and the search costs a request per lesson.
async function resolveAnsweredLesson(superseded?: boolean) {
  const version = superseded ? current.work.value?.lessonVersionId : undefined
  await answered.resolve(selectedRow.value?.courseId, version)
}

function onSelect(id: HomeworkId) {
  current.select(id)
}

function onRetry() {
  void queue.load()
}

function onRetryWork() {
  current.select(current.selectedId.value)
}

function onFilters(next: HomeworkFilters) {
  const refetch = next.status !== queue.filters.value.status
  queue.filters.value = next
  if (refetch) void queue.load()
}

function onReturnAsked() {
  if (!current.work.value || !canGrade.value) return
  confirming.value = true
}

async function onAccept() {
  const work = current.work.value
  if (!work || !canGrade.value || grade.value === undefined) return

  const updated = await grading.accept(work.id, grade.value)
  if (updated) advance(work.id)
}

async function onReturn() {
  const work = current.work.value
  if (!work) return

  const updated = await grading.returnForRevision(work.id)
  if (updated) advance(work.id)
}

/* -------------------------------- Helpers --------------------------------- */

function advance(id: HomeworkId) {
  const next = queue.nextAfter(id)
  queue.remove(id)
  current.select(next)
}
</script>

<template>
  <section :class="paneClasses">
    <QueueFilters
      :filters="queue.filters.value"
      :course-options="queue.directory.courseOptions.value"
      :group-options="queue.directory.groupOptions.value"
      @update:filters="onFilters"
    />
    <div :class="columnsClasses">
      <HomeworkQueueTable
        :rows="queue.rows.value"
        :selected-id="current.selectedId.value"
        :loading="queue.loading.value"
        :error="queue.error.value"
        @select="onSelect"
        @retry="onRetry"
      />
      <div>
        <ErrorState
          v-if="current.error.value"
          :description="current.error.value"
          :retry-label="$t('action-retry')"
          @retry="onRetryWork"
        />
        <Card v-else-if="!current.work.value" :description="$t('homework-pick-work')" padded />
        <HomeworkAnswer
          v-else
          :work="current.work.value"
          :row="selectedRow"
          :reviewer-name="current.reviewerName.value"
          :answered-lesson-id="answered.lessonId.value"
        />
        <ReviewActions
          v-if="current.work.value"
          v-model:grade="grade"
          v-model:confirming="confirming"
          :can-grade="canGrade"
          :busy="grading.busy.value"
          :error="grading.error.value"
          @accept="onAccept"
          @return="onReturn"
        />
      </div>
    </div>
  </section>
</template>
