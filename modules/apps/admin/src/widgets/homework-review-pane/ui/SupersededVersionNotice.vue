<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { SupersededVersionNoticeProps } from '../types'
import { linkClasses, noticeClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<SupersededVersionNoticeProps>()

/* --------------------------------- State ---------------------------------- */

// A version is read through its lesson, and a piece of work names only the
// version, so the lesson is resolved by the pane. Until it arrives — or if it
// never does — the notice still says what happened, without a link that would
// lead nowhere.
const linked = computed(() => props.lessonId !== undefined)

const target = computed(() => ({
  name: 'lesson-version',
  params: { lessonId: props.lessonId, versionId: props.lessonVersionId },
}))
</script>

<template>
  <p :class="noticeClasses" role="status">
    <span>{{ $t('homework-superseded') }}</span>
    <RouterLink v-if="linked" :to="target" :class="linkClasses">
      {{ $t('homework-superseded-open') }}
    </RouterLink>
  </p>
</template>
