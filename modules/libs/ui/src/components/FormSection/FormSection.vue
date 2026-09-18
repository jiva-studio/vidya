<script setup lang="ts">
import { cn } from '../../lib/utils'
import {
  bodyClasses,
  descriptionClasses,
  headerClasses,
  sectionClasses,
  titleClasses,
} from './styles'
import type { FormSectionProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<FormSectionProps>(), {
  title: undefined,
  description: undefined,
  class: undefined,
})
</script>

<template>
  <section :class="cn(sectionClasses, props.class)">
    <header v-if="props.title || props.description" :class="headerClasses">
      <h3 v-if="props.title" :class="titleClasses">{{ props.title }}</h3>
      <p v-if="props.description" :class="descriptionClasses">{{ props.description }}</p>
    </header>
    <div :class="bodyClasses">
      <slot />
    </div>
  </section>
</template>
