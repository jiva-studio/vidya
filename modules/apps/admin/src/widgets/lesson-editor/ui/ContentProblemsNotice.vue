<script setup lang="ts">
import { computed } from 'vue'

import { noticeClasses, noticeListClasses } from './styles'
import type { ContentProblemsNoticeProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<ContentProblemsNoticeProps>(), {
  problems: () => [],
  faults: () => [],
})

/* --------------------------------- State ---------------------------------- */

// Content this build cannot author stops the save; an unfinished block only
// stops the publish, so the two lists are never headed by the same sentence.
const title = computed(() =>
  props.problems.length > 0 ? 'editor-problems-title' : 'editor-faults-title',
)
</script>

<template>
  <div :class="noticeClasses" role="alert">
    <strong>{{ $t(title) }}</strong>
    <ul :class="noticeListClasses">
      <li v-for="(problem, index) in props.problems" :key="`problem-${index}`">
        {{ $t(`editor-problem-${problem.kind}`, { detail: problem.detail }) }}
      </li>
      <li v-for="fault in props.faults" :key="fault.blockId">
        {{ $t('editor-fault-block', { section: fault.section, position: fault.position }) }}
      </li>
    </ul>
  </div>
</template>
