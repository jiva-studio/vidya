<script setup lang="ts">
import { Button } from '@vidya/ui'

import { noticeClasses } from './styles'
import type { LessonOutdatedEmits } from '../types'

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<LessonOutdatedEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onReload() {
  emit('reload')
}
</script>

<template>
  <div :class="noticeClasses">
    <strong>{{ $t('lesson-outdated-title') }}</strong>
    <p>{{ $t('lesson-outdated-text') }}</p>
    <Button @click="onReload">{{ $t('lesson-outdated-reload') }}</Button>
  </div>
</template>
