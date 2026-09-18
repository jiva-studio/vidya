<script setup lang="ts">
import { computed } from 'vue'

import { renderMarkdown } from '@/features/edit-lesson-content'

import { markdownClasses } from './styles'
import type { MarkdownTextProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<MarkdownTextProps>()

/* --------------------------------- State ---------------------------------- */

// The only `v-html` in the admin, and it is fed by the only function that
// sanitises. Keeping the two in one file is what makes that claim checkable.
const html = computed(() => renderMarkdown(props.markdown))
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sanitised where it is built -->
  <div :class="markdownClasses" v-html="html" />
</template>
