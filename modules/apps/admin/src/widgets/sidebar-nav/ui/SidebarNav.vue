<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import type { MenuGroup, MenuItem } from '@/shared/navigation'
import { useCurrentSchool } from '@/shared/access'
import { useSession } from '@/shared/session'
import { grants } from '@/shared/session'

import type { SidebarNavProps } from '../types'
import { groupLabelClasses, itemClasses, navClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<SidebarNavProps>()

/* --------------------------------- State ---------------------------------- */

const { permissions } = useSession()
const { schoolId } = useCurrentSchool()

const visible = computed<MenuGroup[]>(() => props.groups.map(withAllowedItems).filter(hasItems))

/* -------------------------------- Helpers --------------------------------- */

// A menu item without its permission is not dimmed but absent: a greyed-out
// entry with no explanation only spends the reader's attention.
function isAllowed(item: MenuItem): boolean {
  if (!item.permission) return true
  return grants(permissions.value, schoolId.value, item.permission)
}

function withAllowedItems(group: MenuGroup): MenuGroup {
  return { label: group.label, items: group.items.filter(isAllowed) }
}

function hasItems(group: MenuGroup): boolean {
  return group.items.length > 0
}
</script>

<template>
  <nav :class="navClasses" :aria-label="$t('nav-label')">
    <div v-for="group in visible" :key="group.label">
      <p :class="groupLabelClasses">{{ $t(group.label) }}</p>
      <RouterLink
        v-for="item in group.items"
        :key="item.route"
        :class="itemClasses"
        :to="{ name: item.route }"
      >
        {{ $t(item.label) }}
      </RouterLink>
    </div>
  </nav>
</template>
