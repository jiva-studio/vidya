<script setup lang="ts">
import { noticeClasses, noticeListClasses } from './styles'
import type { ContentProblemsNoticeProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<ContentProblemsNoticeProps>()
</script>

<template>
  <div :class="noticeClasses" role="alert">
    <strong>{{ $t('editor-problems-title') }}</strong>
    <ul :class="noticeListClasses">
      <li v-for="(problem, index) in props.problems" :key="index">
        {{ $t(`editor-problem-${problem.kind}`, { detail: problem.detail }) }}
      </li>
    </ul>
  </div>
</template>
