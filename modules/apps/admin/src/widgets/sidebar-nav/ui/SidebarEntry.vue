<script setup lang="ts">
import {
  Building2,
  CheckSquare,
  GraduationCap,
  Inbox,
  Layers,
  LayoutDashboard,
  Library,
  School,
  Settings,
  Shield,
  Users,
} from 'lucide-vue-next'
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { SidebarEntryProps } from '../types'
import {
  activeItemClasses,
  childClasses,
  itemClasses,
  itemIconClasses,
  subListClasses,
} from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SidebarEntryProps>(), {
  child: undefined,
  icon: undefined,
})

const ICON_MAP: Record<string, unknown> = {
  home: LayoutDashboard,
  dashboard: LayoutDashboard,
  building: Building2,
  school: School,
  settings: Settings,
  shield: Shield,
  users: Users,
  book: GraduationCap,
  'graduation-cap': GraduationCap,
  layers: Layers,
  library: Library,
  inbox: Inbox,
  'check-square': CheckSquare,
}

const iconComponent = computed(() => (props.icon ? ICON_MAP[props.icon] : undefined))
</script>

<template>
  <RouterLink :class="itemClasses" :exact-active-class="activeItemClasses.join(' ')" :to="props.to">
    <component :is="iconComponent" v-if="iconComponent" :class="itemIconClasses" />
    <span>{{ props.label }}</span>
  </RouterLink>
  <ul v-if="props.child" :class="subListClasses">
    <li>
      <RouterLink :class="childClasses" :to="props.child.to" aria-current="page">
        {{ props.child.label }}
      </RouterLink>
    </li>
  </ul>
</template>
