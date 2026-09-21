<script setup lang="ts">
import type { AudioBlock, QuizBlock, TextBlock, VideoBlock } from '@vidya/domain'
import { computed } from 'vue'

import MarkdownText from '../MarkdownText'
import MediaPreview from '../MediaPreview'
import QuizPreview from '../QuizPreview'
import { previewBlockClasses, unknownClasses } from './styles'
import type { BlockPreviewProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<BlockPreviewProps>()

/* --------------------------------- State ---------------------------------- */

const text = computed(() => (props.block.type === 'text' ? (props.block as TextBlock) : undefined))
const media = computed(() =>
  props.block.type === 'video' || props.block.type === 'audio'
    ? (props.block as VideoBlock | AudioBlock)
    : undefined,
)
const quiz = computed(() => (props.block.type === 'quiz' ? (props.block as QuizBlock) : undefined))
const unknown = computed(() => !text.value && !media.value && !quiz.value)
const unknownLabel = computed(() => props.labels.describeUnknownBlock(props.block.type))
</script>

<template>
  <div :class="previewBlockClasses">
    <MarkdownText v-if="text" :markdown="text.content" />
    <MediaPreview v-else-if="media" :block="media" :labels="props.labels" />
    <QuizPreview v-else-if="quiz" :block="quiz" :labels="props.labels" />
    <p v-if="unknown" :class="unknownClasses">
      {{ unknownLabel }}
    </p>
  </div>
</template>
