<script setup lang="ts">
import type { AudioBlock, LessonBlock, QuizBlock, TextBlock, VideoBlock } from '@vidya/domain'
import { Badge, Button, Card } from '@vidya/ui'
import { computed } from 'vue'

import AudioBlockEditor from './AudioBlockEditor.vue'
import MoveButtons from './MoveButtons.vue'
import QuizBlockEditor from './QuizBlockEditor.vue'
import { blockHeaderClasses, blockItemClasses } from './styles'
import TextBlockEditor from './TextBlockEditor.vue'
import type { BlockListItemEmits, BlockListItemProps } from './types'
import VideoBlockEditor from './VideoBlockEditor.vue'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<BlockListItemProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<BlockListItemEmits>()

/* --------------------------------- State ---------------------------------- */

// One narrowed reference per kind, because a template cannot narrow a union and
// a dispatcher that casts is a dispatcher that renders the wrong editor quietly.
const text = computed(() => (props.block.type === 'text' ? (props.block as TextBlock) : undefined))
const video = computed(() =>
  props.block.type === 'video' ? (props.block as VideoBlock) : undefined,
)
const audio = computed(() =>
  props.block.type === 'audio' ? (props.block as AudioBlock) : undefined,
)
const quiz = computed(() => (props.block.type === 'quiz' ? (props.block as QuizBlock) : undefined))

/* -------------------------------- Handlers -------------------------------- */

function onUpdate(block: LessonBlock) {
  emit('update', block)
}

function onMove(delta: -1 | 1) {
  emit('move', props.block.id, delta)
}

function onRemove() {
  emit('remove', props.block.id)
}
</script>

<template>
  <Card padded>
    <div :class="blockItemClasses">
      <div :class="blockHeaderClasses">
        <Badge tone="neutral">{{ $t(`editor-block-${props.block.type}`) }}</Badge>
        <MoveButtons
          v-if="!props.frozen"
          :index="props.index"
          :count="props.count"
          :up-label="$t('editor-block-up')"
          :down-label="$t('editor-block-down')"
          @move="onMove"
        />
      </div>
      <TextBlockEditor v-if="text" :block="text" :frozen="props.frozen" @update="onUpdate" />
      <VideoBlockEditor v-if="video" :block="video" :frozen="props.frozen" @update="onUpdate" />
      <AudioBlockEditor v-if="audio" :block="audio" :frozen="props.frozen" @update="onUpdate" />
      <QuizBlockEditor v-if="quiz" :block="quiz" :frozen="props.frozen" @update="onUpdate" />
      <Button v-if="!props.frozen" size="sm" variant="danger" @click="onRemove">
        {{ $t('editor-block-remove') }}
      </Button>
    </div>
  </Card>
</template>
