<script setup lang="ts">
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { outlineEntries } from '../lib'
import { outlineClasses, outlineLinkClasses } from './styles'
import type { LessonOutlineProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<LessonOutlineProps>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const entries = computed(() => outlineEntries(props.sections, $t('editor-section-untitled')))
</script>

<template>
  <nav :class="outlineClasses" :aria-label="$t('editor-sections-label')">
    <a
      v-for="entry in entries"
      :key="entry.anchor"
      :class="outlineLinkClasses"
      :href="`#${entry.anchor}`"
    >
      {{ entry.label }}
    </a>
  </nav>
</template>
