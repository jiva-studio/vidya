<script setup lang="ts">
import {
  descriptionClasses,
  headingsClasses,
  leadingClasses,
  titleClasses,
  titleRowClasses,
} from './styles'
import type { PageTitleProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<PageTitleProps>(), {
  title: undefined,
  description: undefined,
})
</script>

<template>
  <div :class="headingsClasses">
    <div :class="titleRowClasses">
      <span v-if="$slots.leading" :class="leadingClasses"><slot name="leading" /></span>
      <slot v-if="$slots.default" />
      <h1 v-else :class="titleClasses">{{ props.title }}</h1>
    </div>
    <p v-if="props.description" :class="descriptionClasses">{{ props.description }}</p>
  </div>
</template>
