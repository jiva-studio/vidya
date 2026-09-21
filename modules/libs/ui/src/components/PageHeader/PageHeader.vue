<script setup lang="ts">
import PageTitle from './PageTitle.vue'
import { cn } from '../../lib/utils'
import { actionsClasses, headerClasses } from './styles'
import type { PageHeaderProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<PageHeaderProps>(), {
  description: undefined,
  class: undefined,
})
</script>

<template>
  <header :class="cn(headerClasses, props.class)">
    <PageTitle :title="props.title" :description="props.description">
      <template v-if="$slots.leading" #leading><slot name="leading" /></template>
      <template v-if="$slots.title" #default><slot name="title" /></template>
    </PageTitle>
    <div v-if="$slots.actions" :class="actionsClasses">
      <slot name="actions" />
    </div>
  </header>
</template>
