<script setup lang="ts">
import type { AudioBlock, QuizBlock, TextBlock, VideoBlock } from '@vidya/domain'
import { computed } from 'vue'

import MarkdownText from './MarkdownText.vue'
import MediaPreview from './MediaPreview.vue'
import QuizPreview from './QuizPreview.vue'
import { mutedClasses, previewBlockClasses } from './styles'
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
</script>

<template>
  <div :class="previewBlockClasses">
    <MarkdownText v-if="text" :markdown="text.content" />
    <MediaPreview v-else-if="media" :block="media" />
    <QuizPreview v-else-if="quiz" :block="quiz" />
    <p v-if="unknown" :class="mutedClasses">
      {{ $t('editor-preview-unknown', { type: props.block.type }) }}
    </p>
  </div>
</template>
