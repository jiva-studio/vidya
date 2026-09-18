<script setup lang="ts">
import { TriangleAlert } from 'lucide-vue-next'

import Button from '../Button'
import { cn } from '../../lib/utils'
import { descriptionClasses, iconClasses, titleClasses, wrapperClasses } from './styles'
import type { ErrorStateEmits, ErrorStateProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<ErrorStateProps>(), {
  title: 'That did not load',
  retryLabel: 'Try again',
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<ErrorStateEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onRetry() {
  emit('retry')
}
</script>

<template>
  <div :class="cn(wrapperClasses, props.class)" role="alert">
    <p :class="titleClasses">
      <TriangleAlert :class="iconClasses" />
      {{ props.title }}
    </p>
    <p :class="descriptionClasses">{{ props.description }}</p>
    <Button v-if="props.retryLabel" variant="secondary" size="sm" @click="onRetry">
      {{ props.retryLabel }}
    </Button>
  </div>
</template>
