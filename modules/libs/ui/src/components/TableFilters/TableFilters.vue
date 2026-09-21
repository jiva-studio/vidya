<script setup lang="ts">
import { Search, X } from 'lucide-vue-next'
import { onBeforeUnmount, ref, watch } from 'vue'

import Input from '../Input'
import { cn } from '../../lib/utils'
import {
  actionsClasses,
  clearButtonClasses,
  clearIconClasses,
  filtersClasses,
  searchIconClasses,
  searchInputClasses,
  searchWrapClasses,
  wrapperClasses,
} from './styles'
import type { TableFiltersEmits, TableFiltersProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<TableFiltersProps>(), {
  search: '',
  searchPlaceholder: 'Поиск...',
  searchLabel: 'Поиск по списку',
  searchDebounce: 250,
  filtersApplied: false,
  clearLabel: 'Очистить',
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<TableFiltersEmits>()

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
  term.value = ''
  clearTimeout(pending.value)
  emit('update:search', '')
  emit('clear')
}
</script>

<template>
  <div :class="cn(wrapperClasses, props.class)">
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
      <button
        v-if="term || props.filtersApplied"
        type="button"
        :class="clearButtonClasses"
        :aria-label="props.clearLabel"
        @click="onClear"
      >
        <X :class="clearIconClasses" />
      </button>
    </div>
    <div v-if="$slots.filters" :class="filtersClasses">
      <slot name="filters" />
    </div>
    <div v-if="$slots.actions" :class="actionsClasses">
      <slot name="actions" />
    </div>
  </div>
</template>
