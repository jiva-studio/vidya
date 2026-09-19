<script setup lang="ts">
import BlockPreview from './BlockPreview.vue'
import { previewSectionClasses, previewTitleClasses } from './styles'
import type { SectionPreviewProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<SectionPreviewProps>()
</script>

<template>
  <article :class="previewSectionClasses">
    <h3 :class="previewTitleClasses">
      {{ props.section.title || $t('editor-section-untitled') }}
    </h3>
    <BlockPreview v-for="block in props.section.blocks" :key="block.id" :block="block" />
  </article>
</template>
