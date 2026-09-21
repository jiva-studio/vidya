<script setup lang="ts">
import { Select } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'

import { ANY, asFilter } from '@/shared/lib'

import { filterClasses } from './styles'
import type { GroupsCourseFilterEmits, GroupsCourseFilterProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<GroupsCourseFilterProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<GroupsCourseFilterEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const selected = computed(() => props.modelValue || ANY)

const choices = computed(() => [{ value: ANY, label: $t('groups-filter-all') }, ...props.options])

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
    :placeholder="$t('groups-filter-all')"
    :aria-label="$t('groups-filter-course')"
    @update:model-value="onSelect"
  />
</template>
