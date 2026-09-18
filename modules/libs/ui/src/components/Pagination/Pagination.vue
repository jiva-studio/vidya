<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { PaginationList, PaginationNext, PaginationPrev, PaginationRoot } from 'reka-ui'
import { computed } from 'vue'

import PaginationItem from './PaginationItem.vue'
import { cn } from '../../lib/utils'
import { iconClasses, listClasses, rootClasses, stepClasses, summaryClasses } from './styles'
import type { PaginationEmits, PaginationListItemData, PaginationProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<PaginationProps>(), {
  page: 1,
  previousLabel: 'Previous page',
  nextLabel: 'Next page',
  summaryLabel: undefined,
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<PaginationEmits>()

/* --------------------------------- State ---------------------------------- */

const summary = computed(() => props.summaryLabel ?? defaultSummary())

/* -------------------------------- Handlers -------------------------------- */

function onPage(page: number) {
  emit('update:page', page)
}

/* -------------------------------- Helpers --------------------------------- */

function defaultSummary(): string {
  const first = (props.page - 1) * props.perPage + 1
  const last = Math.min(props.page * props.perPage, props.total)
  return `${first}–${last} of ${props.total}`
}

function asItems(items: unknown): PaginationListItemData[] {
  return items as PaginationListItemData[]
}
</script>

<template>
  <PaginationRoot
    :page="props.page"
    :items-per-page="props.perPage"
    :total="props.total"
    :sibling-count="1"
    show-edges
    :class="cn(rootClasses, props.class)"
    @update:page="onPage"
  >
    <p :class="summaryClasses">{{ summary }}</p>
    <PaginationList v-slot="{ items }" :class="listClasses">
      <PaginationPrev :class="stepClasses" :aria-label="props.previousLabel">
        <ChevronLeft :class="iconClasses" />
      </PaginationPrev>
      <PaginationItem v-for="(item, index) in asItems(items)" :key="index" :item="item" />
      <PaginationNext :class="stepClasses" :aria-label="props.nextLabel">
        <ChevronRight :class="iconClasses" />
      </PaginationNext>
    </PaginationList>
  </PaginationRoot>
</template>
