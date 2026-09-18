<script setup lang="ts">
import { ChevronsUpDown } from 'lucide-vue-next'
import {
  ComboboxAnchor,
  ComboboxContent,
  ComboboxInput,
  ComboboxRoot,
  ComboboxTrigger,
} from 'reka-ui'
import { computed, onBeforeUnmount, ref, watch } from 'vue'

import ComboboxList from './ComboboxList.vue'
import { cn } from '../../lib/utils'
import { anchorVariants, contentClasses, iconClasses, inputClasses } from './styles'
import type { ComboboxEmits, ComboboxProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<ComboboxProps>(), {
  modelValue: undefined,
  placeholder: 'Search',
  emptyLabel: 'Nothing matches that search.',
  disabled: false,
  invalid: false,
  searchDebounce: 250,
  id: undefined,
  describedBy: undefined,
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<ComboboxEmits>()

/* --------------------------------- State ---------------------------------- */

const term = ref('')
const pending = ref<ReturnType<typeof setTimeout> | undefined>(undefined)
const selectedLabel = computed(() => labelFor(props.modelValue))

/* --------------------------------- Hooks ---------------------------------- */

watch(term, (value) => scheduleSearch(value))

onBeforeUnmount(() => clearTimeout(pending.value))

/* -------------------------------- Handlers -------------------------------- */

function onUpdate(value: unknown) {
  if (value === undefined || value === null) return
  emit('update:modelValue', String(value))
}

/* -------------------------------- Helpers --------------------------------- */

function labelFor(value: string | undefined): string {
  return props.options.find((option) => option.value === value)?.label ?? ''
}

function scheduleSearch(value: string) {
  clearTimeout(pending.value)
  pending.value = setTimeout(() => emit('search', value), props.searchDebounce)
}
</script>

<template>
  <ComboboxRoot
    :model-value="props.modelValue"
    :disabled="props.disabled"
    open-on-focus
    open-on-click
    :class="cn('relative', props.class)"
    @update:model-value="onUpdate"
  >
    <ComboboxAnchor :class="anchorVariants({ invalid: props.invalid })">
      <ComboboxInput
        :id="props.id"
        v-model="term"
        :class="inputClasses"
        :placeholder="selectedLabel || props.placeholder"
        :aria-invalid="props.invalid || undefined"
        :aria-describedby="props.describedBy"
      />
      <ComboboxTrigger>
        <ChevronsUpDown :class="iconClasses" />
      </ComboboxTrigger>
    </ComboboxAnchor>
    <ComboboxContent :class="contentClasses" position="inline">
      <ComboboxList :options="props.options" :empty-label="props.emptyLabel" />
    </ComboboxContent>
  </ComboboxRoot>
</template>
