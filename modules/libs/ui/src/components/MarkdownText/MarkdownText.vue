<script setup lang="ts">
import { computed } from 'vue'

import { renderInlineMarkdown, renderMarkdown } from '../../lib/markdown'
import { markdownClasses } from './styles'
import type { MarkdownTextProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<MarkdownTextProps>(), { inline: false })

/* --------------------------------- State ---------------------------------- */

// The only `v-html` in the library, and it is fed by the only two functions
// that sanitise. Keeping them in one file is what makes that claim checkable.
const html = computed(() =>
  props.inline ? renderInlineMarkdown(props.markdown) : renderMarkdown(props.markdown),
)
</script>

<template>
  <!-- Inline text sits inside a line somebody else laid out, so it brings
       neither a block box nor the prose measure with it. -->
  <!-- eslint-disable-next-line vue/no-v-html -- sanitised where it is built -->
  <span v-if="props.inline" v-html="html" />
  <!-- eslint-disable-next-line vue/no-v-html -- sanitised where it is built -->
  <div v-else :class="markdownClasses" v-html="html" />
</template>
