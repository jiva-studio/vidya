<script setup lang="ts">
import type { HomeworkId } from '@vidya/domain'
import type { HomeworkDetails } from '@vidya/protocol'
import { Breadcrumbs, Button, FailureState, PageHeader, Skeleton } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'

import { useHomework } from '@/entities/homework'
import { isGradeGiven, ReviewActions, useGradeHomework } from '@/features/grade-homework'
import { useCan } from '@/shared/access'

import { useReviewKeyboard, useReviewQueue, useWorkContext } from '../model'
import HomeworkWork from './HomeworkWork.vue'
import ReviewQueueNav from './ReviewQueueNav.vue'
import { sectionClasses } from './styles'
import type { HomeworkReviewPageProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<HomeworkReviewPageProps>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const router = useRouter()

const details = useHomework()
const { context } = useWorkContext(details.work)
const queue = useReviewQueue(computed(() => props.id))
const grading = useGradeHomework()
const canGrade = useCan('homework:grade')

const grade = ref<number | undefined>(undefined)
const confirming = ref(false)

const breadcrumbs = computed(() => [
  { key: 'homework', label: $t('homework-title') },
  { key: 'current', label: context.value.studentName ?? $t('homework-review-title') },
])


/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void details.load(props.id)
  void queue.load()
})

watch(
  () => props.id,
  (id) => {
    void details.load(id)
  },
)

watch(details.work, (opened) => {
  grade.value = opened?.grade
  confirming.value = false
})

useReviewKeyboard({
  accept: () => void onAccept(),
  returnWork: () => onReturnAsked(),
  next: () => onNext(),
})

/* -------------------------------- Handlers -------------------------------- */

function onBreadcrumb(key: string) {
  if (key === 'homework') void router.push({ name: 'homework-queue' })
}

function onBack() {
  void router.push({ name: 'homework-queue' })
}

function onRetry() {
  void details.load(props.id)
}

function onNext() {
  const next = queue.next.value
  if (next) open(next)
}

function onReturnAsked() {
  if (!details.work.value || !canGrade.value) return
  confirming.value = true
}

async function onAccept() {
  const work = details.work.value
  if (!work || !canGrade.value || !isGradeGiven(grade.value)) return

  const updated = await grading.accept(work.id, grade.value)
  if (updated) advance(work.id, updated)
}

async function onReturn() {
  const work = details.work.value
  if (!work) return

  const updated = await grading.returnForRevision(work.id)
  if (updated) advance(work.id, updated)
}

/* -------------------------------- Helpers --------------------------------- */

function open(id: HomeworkId) {
  void router.push({ name: 'homework-review', params: { id } })
}

// A decided work is left on screen when nothing follows it, so the reviewer
// sees the decision land rather than an empty page.
function advance(id: HomeworkId, updated: HomeworkDetails) {
  const next = queue.next.value
  queue.markDecided(id)

  if (next) open(next)
  else details.replace(updated)
}
</script>

<template>
  <section :class="sectionClasses">
    <PageHeader :title="$t('homework-review-title')">
      <template #breadcrumbs>
        <Breadcrumbs :items="breadcrumbs" @select="onBreadcrumb" />
      </template>
      <template #actions>
        <Button variant="ghost" @click="onBack">{{ $t('homework-back-to-list') }}</Button>
      </template>
    </PageHeader>
    <Skeleton v-if="details.loading.value" shape="block" :lines="6" />
    <FailureState
      v-else-if="details.error.value"
      :title="$t('state-error-title')"
      :description="$t('state-error')"
      :retry-label="$t('action-retry')"
      @retry="onRetry"
    />
    <template v-else-if="details.work.value">
      <HomeworkWork :work="details.work.value" :context="context" />
      <ReviewActions
        v-model:grade="grade"
        v-model:confirming="confirming"
        :can-grade="canGrade"
        :busy="grading.busy.value"
        @accept="onAccept"
        @return="onReturn"
      />
      <ReviewQueueNav :remaining="queue.remaining.value" @next="onNext" />
    </template>
  </section>
</template>
