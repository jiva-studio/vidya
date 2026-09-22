<script setup lang="ts">
import type { BlockId, LessonBlockState } from '@vidya/domain'

import BlockPreview from '../BlockPreview'
import { previewSectionClasses, previewTitleClasses } from './styles'
import type { SectionPreviewEmits, SectionPreviewProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SectionPreviewProps>(), { progress: undefined })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SectionPreviewEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onChange(blockId: BlockId, state: LessonBlockState) {
  emit('change', blockId, state)
}
</script>

<template>
  <article :class="previewSectionClasses">
    <h3 :class="previewTitleClasses">
      {{ props.section.title || props.labels.untitledSection }}
    </h3>
    <BlockPreview
      v-for="block in props.section.blocks"
      :key="block.id"
      :block="block"
      :labels="props.labels"
      :progress="props.progress"
      @change="onChange"
    />

    <!-- What a section carries besides its blocks — homework, a grade — is the
         screen's to draw: the library knows the lesson, not the student's
         standing on it. -->
    <slot name="footer" :section="props.section" />
  </article>
</template>
