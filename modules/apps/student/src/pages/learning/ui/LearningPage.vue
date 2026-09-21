<script setup lang="ts">
import { EmptyState } from '@vidya/ui'
import { computed } from 'vue'

import { useSiteStatus } from '@/shared/status'
import { BackfillProgress, mutedClasses, pageClasses, titleClasses } from '@/shared/ui'

import { pickLearningView, useJoinedSchools } from '../model'

/* --------------------------------- State ---------------------------------- */

const status = useSiteStatus()
const { schools } = useJoinedSchools()

const view = computed(() =>
  pickLearningView({
    schools: schools.value.length,
    filled: status.firstRunCompleted.value,
    joined: status.joined.value,
  }),
)
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('learning-title') }}</h1>

    <BackfillProgress
      v-if="view === 'arriving'"
      :rows="status.done.value"
      :running="status.syncing.value"
    />

    <EmptyState
      v-else-if="view === 'uninvited'"
      :title="$t('learning-uninvited-title')"
      :description="$t('learning-uninvited-text')"
    />

    <p v-else :class="mutedClasses">{{ $t('learning-empty') }}</p>
  </section>
</template>
