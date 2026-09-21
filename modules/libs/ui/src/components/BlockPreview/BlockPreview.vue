<script setup lang="ts">
import type { AudioBlock, LessonBlockState, QuizBlock, TextBlock, VideoBlock } from '@vidya/domain'
import { computed } from 'vue'

import MarkdownText from '../MarkdownText'
import MediaPreview from '../MediaPreview'
import QuizPreview from '../QuizPreview'
import { markClasses, previewBlockClasses, unknownClasses } from './styles'
import type { BlockPreviewEmits, BlockPreviewProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<BlockPreviewProps>(), { progress: undefined })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<BlockPreviewEmits>()

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

const done = computed(() => props.progress?.states[props.block.id])
const isRead = computed(() => done.value?.type === 'text' && done.value.read)

// Reading is what the student did, not a box they keep: once it is recorded
// there is nothing further to say, and taking the mark back would file the
// lesson as unread while every word of it has been read.
const markable = computed(() => props.progress?.editable === true && !isRead.value)

/* -------------------------------- Handlers -------------------------------- */

function onRead() {
  emit('change', props.block.id, { type: 'text', read: true })
}

function onChange(state: LessonBlockState) {
  emit('change', props.block.id, state)
}
</script>

<template>
  <div :class="previewBlockClasses">
    <template v-if="text">
      <MarkdownText :markdown="text.content" />
      <label v-if="props.progress" :class="markClasses">
        <input type="checkbox" :checked="isRead" :disabled="!markable" @change="onRead" />
        {{ props.progress.labels.markRead }}
      </label>
    </template>
    <MediaPreview
      v-else-if="media"
      :block="media"
      :labels="props.labels"
      :progress="props.progress"
      @change="onChange"
    />
    <QuizPreview
      v-else-if="quiz"
      :block="quiz"
      :labels="props.labels"
      :progress="props.progress"
      @change="onChange"
    />
    <p v-if="unknown" :class="unknownClasses">
      {{ unknownLabel }}
    </p>
  </div>
</template>
