<script setup lang="ts">
import SectionPreview from '../SectionPreview'
import { previewClasses } from './styles'
import type { LessonPreviewProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<LessonPreviewProps>()
</script>

<template>
  <div :class="previewClasses">
    <SectionPreview
      v-for="section in props.content.sections"
      :key="section.id"
      :section="section"
      :labels="props.labels"
    />
  </div>
</template>
