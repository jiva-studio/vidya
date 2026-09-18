<script setup lang="ts">
import { Search } from 'lucide-vue-next'
import { onBeforeUnmount, ref, watch } from 'vue'

import Button from '../Button'
import Input from '../Input'
import { cn } from '../../lib/utils'
import {
  actionsClasses,
  filtersClasses,
  searchIconClasses,
  searchInputClasses,
  searchWrapClasses,
  toolbarClasses,
} from './styles'
import type { TableToolbarEmits, TableToolbarProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<TableToolbarProps>(), {
  search: '',
  searchPlaceholder: 'Search',
  searchLabel: 'Search the list',
  searchDebounce: 250,
  filtersApplied: false,
  clearLabel: 'Clear filters',
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<TableToolbarEmits>()

/* --------------------------------- State ---------------------------------- */

const term = ref(props.search)
const pending = ref<ReturnType<typeof setTimeout> | undefined>(undefined)

/* --------------------------------- Hooks ---------------------------------- */

watch(
  () => props.search,
  (value) => {
    term.value = value
  },
)

onBeforeUnmount(() => clearTimeout(pending.value))

/* -------------------------------- Handlers -------------------------------- */

function onTerm(value: string) {
  term.value = value
  clearTimeout(pending.value)
  pending.value = setTimeout(() => emit('update:search', value), props.searchDebounce)
}

function onClear() {
  emit('clear')
}
</script>

<template>
  <div :class="cn(toolbarClasses, props.class)">
    <div :class="searchWrapClasses">
      <Search :class="searchIconClasses" />
      <Input
        :model-value="term"
        :placeholder="props.searchPlaceholder"
        :aria-label="props.searchLabel"
        type="search"
        size="md"
        :class="cn(searchInputClasses)"
        @update:model-value="onTerm"
      />
    </div>
    <div :class="filtersClasses">
      <slot name="filters" />
    </div>
    <Button v-if="props.filtersApplied" variant="ghost" size="sm" @click="onClear">
      {{ props.clearLabel }}
    </Button>
    <div :class="actionsClasses">
      <slot name="actions" />
    </div>
  </div>
</template>
