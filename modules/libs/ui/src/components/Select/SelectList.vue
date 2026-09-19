<script setup lang="ts">
import { Check } from 'lucide-vue-next'
import { SelectItem, SelectItemIndicator, SelectItemText, SelectViewport } from 'reka-ui'

import { markClasses, optionClasses } from './styles'
import type { SelectListProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<SelectListProps>()
</script>

<template>
  <SelectViewport>
    <SelectItem
      v-for="option in props.options"
      :key="option.value"
      :value="option.value"
      :disabled="option.disabled"
      :class="optionClasses"
    >
      <SelectItemText>{{ option.label }}</SelectItemText>
      <SelectItemIndicator>
        <Check :class="markClasses" />
      </SelectItemIndicator>
    </SelectItem>
  </SelectViewport>
</template>
