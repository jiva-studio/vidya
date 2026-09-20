<script setup lang="ts">
import { cn } from '../../lib/utils'
import {
  actionsClasses,
  descriptionClasses,
  headerClasses,
  headingsClasses,
  rowClasses,
  titleClasses,
} from './styles'
import type { PageHeaderProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<PageHeaderProps>(), {
  description: undefined,
  class: undefined,
})
</script>

<template>
  <header :class="cn(headerClasses, props.class)">
    <slot name="breadcrumbs" />
    <div :class="rowClasses">
      <div :class="headingsClasses">
        <slot v-if="$slots.title" name="title" />
        <h1 v-else :class="titleClasses">{{ props.title }}</h1>
        <p v-if="props.description" :class="descriptionClasses">{{ props.description }}</p>
      </div>
      <div v-if="$slots.actions" :class="actionsClasses">
        <slot name="actions" />
      </div>
    </div>
  </header>
</template>
