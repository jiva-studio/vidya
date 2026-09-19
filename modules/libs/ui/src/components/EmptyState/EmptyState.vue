<script setup lang="ts">
import Button from '../Button'
import { cn } from '../../lib/utils'
import { actionClasses, descriptionClasses, titleClasses, wrapperClasses } from './styles'
import type { EmptyStateEmits, EmptyStateProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<EmptyStateProps>(), {
  actionLabel: undefined,
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<EmptyStateEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onAction() {
  emit('action')
}
</script>

<template>
  <div :class="cn(wrapperClasses, props.class)">
    <p :class="titleClasses">{{ props.title }}</p>
    <p :class="descriptionClasses">{{ props.description }}</p>
    <Button v-if="props.actionLabel" :class="cn(actionClasses)" @click="onAction">
      {{ props.actionLabel }}
    </Button>
    <slot />
  </div>
</template>
