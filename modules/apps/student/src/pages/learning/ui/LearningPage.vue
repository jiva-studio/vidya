<script setup lang="ts">
import { EmptyState, Skeleton } from '@vidya/ui'
import { computed } from 'vue'

import { useSiteStatus } from '@/shared/status'
import { BackfillProgress, pageClasses, titleClasses } from '@/shared/ui'

import { pickLearningView, useLearningCards } from '../model'
import LearningCard from './LearningCard.vue'
import { listClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const status = useSiteStatus()
const { schools, cards, reading } = useLearningCards()

const view = computed(() =>
  pickLearningView({
    schools: schools.value.length,
    filled: status.firstRunCompleted.value,
    joined: status.joined.value,
  }),
)

const studying = computed(() => cards.value.length > 0)
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('learning-title') }}</h1>

    <Skeleton v-if="reading" :lines="3" />

    <BackfillProgress
      v-else-if="view === 'arriving'"
      :rows="status.done.value"
      :running="status.syncing.value"
    />

    <EmptyState
      v-else-if="view === 'uninvited'"
      :title="$t('learning-uninvited-title')"
      :description="$t('learning-uninvited-text')"
    />

    <div v-else-if="studying" :class="listClasses">
      <LearningCard v-for="card in cards" :key="card.id" :card="card" />
    </div>

    <EmptyState
      v-else
      :title="$t('learning-no-courses-title')"
      :description="$t('learning-no-courses-text')"
    />
  </section>
</template>
