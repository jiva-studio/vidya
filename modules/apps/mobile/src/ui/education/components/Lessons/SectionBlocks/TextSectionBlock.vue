<template>
  <!-- eslint-disable-next-line vue/no-v-html -- sanitised where it is built -->
  <div class="ion-padding-start ion-padding-end" v-html="renderedContent" />
</template>

<script lang="ts" setup>
import { Marked } from '@ts-stack/markdown'
import DOMPurify from 'dompurify'
import { computed } from 'vue'
import type { TextSectionBlockProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<TextSectionBlockProps>()

/* --------------------------------- State ---------------------------------- */

// Markdown becomes HTML, and that HTML was authored by someone at the school
// rather than by us. Sanitising is what makes the v-html above safe.
const renderedContent = computed(() => DOMPurify.sanitize(Marked.parse(props.block.content)))
</script>
