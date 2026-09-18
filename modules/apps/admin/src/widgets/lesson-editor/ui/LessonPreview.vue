<script setup lang="ts">
import { Card } from '@vidya/ui'

import SectionPreview from './SectionPreview.vue'
import { previewClasses } from './styles'
import type { LessonPreviewProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<LessonPreviewProps>()
</script>

<template>
  <Card :title="$t('editor-preview-title')" :description="$t('editor-preview-body')" padded>
    <div :class="previewClasses">
      <SectionPreview
        v-for="section in props.content.sections"
        :key="section.id"
        :section="section"
      />
    </div>
  </Card>
</template>
