<script setup lang="ts">
import { Select, type SelectOption } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { ANY, asFilter } from '@/shared/lib'

import { filterClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<{
  modelValue: string
  options: SelectOption[]
}>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const selected = computed(() => props.modelValue || ANY)

const choices = computed(() => [{ value: ANY, label: $t('lessons-filter-all') }, ...props.options])

/* -------------------------------- Handlers -------------------------------- */

function onSelect(value: string) {
  emit('update:modelValue', asFilter(value) ?? '')
}
</script>

<template>
  <Select
    :class="filterClasses"
    :model-value="selected"
    :options="choices"
    :placeholder="$t('lessons-filter-all')"
    :aria-label="$t('lessons-filter-course')"
    @update:model-value="onSelect"
  />
</template>
