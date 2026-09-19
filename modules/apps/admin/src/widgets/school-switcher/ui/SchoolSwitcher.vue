<script setup lang="ts">
import type { SchoolId } from '@vidya/domain'
import { computed, onMounted } from 'vue'

import { useSchoolOptions } from '@/features/switch-school'

import {
  selectClasses,
  selectContainerClasses,
  selectIconClasses,
  singleClasses,
  wrapperClasses,
} from './styles'

/* --------------------------------- State ---------------------------------- */

const schools = useSchoolOptions()

const current = computed(() => schools.current.value)
const currentName = computed(() => nameOf(current.value))

/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void schools.load()
})

/* -------------------------------- Handlers -------------------------------- */

function onSelect(event: Event) {
  schools.select((event.target as HTMLSelectElement).value as unknown as SchoolId)
}

/* -------------------------------- Helpers --------------------------------- */

function nameOf(id: SchoolId | undefined): string {
  if (!id) return ''
  const option = schools.options.value.find((candidate) => candidate.id === id)
  return option?.name || String(id)
}
</script>

<template>
  <div :class="wrapperClasses">
    <div v-if="schools.hasChoice.value" :class="selectContainerClasses">
      <select
        :class="selectClasses"
        :value="current"
        :aria-label="$t('school-switcher-label')"
        @change="onSelect"
      >
        <option v-for="option in schools.options.value" :key="option.id" :value="option.id">
          {{ option.name || option.id }}
        </option>
      </select>
      <svg
        :class="selectIconClasses"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </div>
    <div v-else :class="singleClasses">{{ currentName }}</div>
  </div>
</template>
