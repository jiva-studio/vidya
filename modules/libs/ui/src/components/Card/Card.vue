<script setup lang="ts">
import { cn } from '../../lib/utils'
import {
  cardVariants,
  descriptionClasses,
  footerClasses,
  headerClasses,
  titleClasses,
} from './styles'
import type { CardProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<CardProps>(), {
  title: undefined,
  description: undefined,
  padded: true,
  class: undefined,
})
</script>

<template>
  <section :class="cn(cardVariants({ padded: props.padded }), props.class)">
    <header v-if="props.title || props.description" :class="headerClasses">
      <h2 v-if="props.title" :class="titleClasses">{{ props.title }}</h2>
      <p v-if="props.description" :class="descriptionClasses">{{ props.description }}</p>
    </header>
    <slot />
    <footer v-if="$slots.footer" :class="footerClasses">
      <slot name="footer" />
    </footer>
  </section>
</template>
