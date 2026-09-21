<script setup lang="ts">
import type { BlockId, LessonBlockState } from '@vidya/domain'

import SectionPreview from '../SectionPreview'
import { previewClasses } from './styles'
import type { LessonPreviewEmits, LessonPreviewProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<LessonPreviewProps>(), { progress: undefined })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<LessonPreviewEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onChange(blockId: BlockId, state: LessonBlockState) {
  emit('change', blockId, state)
}
</script>

<template>
  <div :class="previewClasses">
    <SectionPreview
      v-for="section in props.content.sections"
      :key="section.id"
      :section="section"
      :labels="props.labels"
      :progress="props.progress"
      @change="onChange"
    />
  </div>
</template>
