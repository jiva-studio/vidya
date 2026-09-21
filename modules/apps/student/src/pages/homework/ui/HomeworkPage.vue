<script setup lang="ts">
import { EmptyState, Skeleton } from '@vidya/ui'
import { computed } from 'vue'

import { useSiteStatus } from '@/shared/status'
import { BackfillProgress, pageClasses, titleClasses } from '@/shared/ui'

import { pickHomeworkView, useHomeworkCards } from '../model'
import HomeworkCard from './HomeworkCard.vue'
import { listClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const status = useSiteStatus()
const { cards, reading } = useHomeworkCards()

const view = computed(() =>
  pickHomeworkView({
    reading: reading.value,
    answers: cards.value.length,
    filled: status.firstRunCompleted.value,
  }),
)
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('homework-title') }}</h1>

    <Skeleton v-if="view === 'reading'" :lines="3" />

    <BackfillProgress v-else-if="view === 'arriving'" :running="status.syncing.value" />

    <EmptyState
      v-else-if="view === 'empty'"
      :title="$t('homework-empty-title')"
      :description="$t('homework-empty-text')"
    />

    <ol v-else :class="listClasses">
      <HomeworkCard v-for="card in cards" :key="card.answer.id" :card="card" />
    </ol>
  </section>
</template>
