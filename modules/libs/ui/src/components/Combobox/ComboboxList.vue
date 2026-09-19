<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { ComboboxEmpty, ComboboxItem, ComboboxItemIndicator } from 'reka-ui'

import { emptyClasses, markClasses, optionClasses } from './styles'
import type { ComboboxListProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<ComboboxListProps>()
</script>

<template>
  <ComboboxEmpty :class="emptyClasses">{{ props.emptyLabel }}</ComboboxEmpty>
  <ComboboxItem
    v-for="option in props.options"
    :key="option.value"
    :value="option.value"
    :disabled="option.disabled"
    :class="optionClasses"
  >
    {{ option.label }}
    <ComboboxItemIndicator>
      <Check :class="markClasses" />
    </ComboboxItemIndicator>
  </ComboboxItem>
</template>
