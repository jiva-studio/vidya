<script setup lang="ts">
import { ChevronRight } from 'lucide-vue-next'

import { currentClasses, iconClasses, itemClasses, linkClasses, listClasses } from './styles'
import type { BreadcrumbsEmits, BreadcrumbsProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<BreadcrumbsProps>(), {
  label: 'Breadcrumb',
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<BreadcrumbsEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onSelect(key: string) {
  emit('select', key)
}

/* -------------------------------- Helpers --------------------------------- */

function isLast(index: number): boolean {
  return index === props.items.length - 1
}
</script>

<template>
  <nav :aria-label="props.label" :class="props.class">
    <ol :class="listClasses">
      <li v-for="(item, index) in props.items" :key="item.key" :class="itemClasses">
        <ChevronRight v-if="index > 0" :class="iconClasses" aria-hidden="true" />
        <span v-if="isLast(index)" :class="currentClasses" aria-current="page">
          {{ item.label }}
        </span>
        <a v-else :href="item.href" :class="linkClasses" @click="onSelect(item.key)">
          {{ item.label }}
        </a>
      </li>
    </ol>
  </nav>
</template>
