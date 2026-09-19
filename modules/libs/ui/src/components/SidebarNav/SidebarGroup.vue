<script setup lang="ts">
import SidebarItem from './SidebarItem.vue'
import { cn } from '../../lib/utils'
import { groupClasses, groupLabelClasses, listClasses } from './styles'
import type { SidebarGroupEmits, SidebarGroupProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SidebarGroupProps>(), { class: undefined })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SidebarGroupEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onSelect(key: string) {
  emit('select', key)
}
</script>

<template>
  <div :class="cn(groupClasses, props.class)">
    <p v-if="props.group.label" :class="groupLabelClasses">{{ props.group.label }}</p>
    <ul :class="listClasses">
      <li v-for="item in props.group.items" :key="item.key">
        <SidebarItem :item="item" @select="onSelect" />
      </li>
    </ul>
  </div>
</template>
