<script setup lang="ts">
import SidebarGroup from './SidebarGroup.vue'
import { cn } from '../../lib/utils'
import { navClasses } from './styles'
import type { SidebarNavEmits, SidebarNavProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SidebarNavProps>(), {
  label: 'Sections',
  class: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SidebarNavEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onSelect(key: string) {
  emit('select', key)
}
</script>

<template>
  <nav :class="cn(navClasses, props.class)" :aria-label="props.label">
    <SidebarGroup
      v-for="group in props.groups"
      :key="group.key"
      :group="group"
      @select="onSelect"
    />
  </nav>
</template>
