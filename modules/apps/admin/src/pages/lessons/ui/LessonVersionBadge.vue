<script setup lang="ts">
import { Badge } from '@vidya/ui'
import type { BadgeTone } from '@vidya/ui'
import { computed } from 'vue'

import type { LessonVersionBadgeProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<LessonVersionBadgeProps>(), {
  state: undefined,
  publishedVersion: undefined,
  draftVersion: undefined,
})

/* --------------------------------- State ---------------------------------- */

// A lesson being written is neutral, live content is a success, and a revision
// in progress is a warning: it means students are reading something older than
// what is open in the editor.
const tones: Record<string, BadgeTone> = {
  draft: 'neutral',
  published: 'success',
  revising: 'warning',
}

const labels: Record<string, string> = {
  draft: 'lesson-version-draft',
  published: 'lesson-version-published',
  revising: 'lesson-version-revising',
}

const tone = computed<BadgeTone>(() => (props.state ? tones[props.state] : 'neutral'))
const label = computed(() => (props.state ? labels[props.state] : 'lesson-version-unknown'))

const args = computed(() => ({
  published: props.publishedVersion ?? 0,
  draft: props.draftVersion ?? 0,
}))
</script>

<template>
  <Badge :tone="tone">{{ $t(label, args) }}</Badge>
</template>
