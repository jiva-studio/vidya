<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink, useRouter } from 'vue-router'

import type { SupersededVersionNoticeProps } from '../types'
import { linkClasses, noticeClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<SupersededVersionNoticeProps>()

/* --------------------------------- State ---------------------------------- */

const router = useRouter()

// The lesson editor is written on another branch. Until its route exists the
// notice still says what happened; it gains the link the moment it does.
const linked = computed(() => router.hasRoute('lesson-version'))

const target = computed(() => ({
  name: 'lesson-version',
  params: { id: props.lessonVersionId },
}))
</script>

<template>
  <p :class="noticeClasses" role="status">
    <span>{{ $t('homework-superseded') }}</span>
    <RouterLink v-if="linked" :to="target" :class="linkClasses">
      {{ $t('homework-superseded-open') }}
    </RouterLink>
  </p>
</template>
