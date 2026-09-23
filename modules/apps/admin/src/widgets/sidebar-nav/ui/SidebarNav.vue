<script setup lang="ts">
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { useCurrentSchool } from '@/shared/access'
import type { MenuGroup, MenuItem, NavPlacement } from '@/shared/navigation'
import { useOpenPageTitle } from '@/shared/navigation'
import { grants, useSession } from '@/shared/session'

import type { SidebarEntryChild, SidebarNavProps } from '../types'
import SidebarEntry from './SidebarEntry.vue'
import { groupClasses, groupLabelClasses, navClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<SidebarNavProps>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const route = useRoute()
const openTitle = useOpenPageTitle()
const { permissions } = useSession()
const { schoolId } = useCurrentSchool()

const visible = computed<MenuGroup[]>(() => props.groups.map(withAllowedItems).filter(hasItems))

// The page on screen, when it is one that lives under a sidebar entry rather
// than being one. There is at most one: it is where the reader is.
const placement = computed<NavPlacement | undefined>(
  () => route.meta.nav as NavPlacement | undefined,
)

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

function childOf(item: MenuItem): SidebarEntryChild | undefined {
  const open = placement.value
  if (open?.parent !== item.route) return undefined

  return { label: openTitle.value ?? $t(open.label), to: route.fullPath }
}

function entryTo(item: MenuItem) {
  return { name: item.route, params: { schoolId: schoolId.value } }
}
</script>

<template>
  <nav :class="navClasses" :aria-label="$t('nav-label')">
    <div v-for="group in visible" :key="group.label" :class="groupClasses">
      <p :class="groupLabelClasses">{{ $t(group.label) }}</p>
      <SidebarEntry
        v-for="item in group.items"
        :key="item.route"
        :label="$t(item.label)"
        :icon="item.icon"
        :to="entryTo(item)"
        :child="childOf(item)"
      />
    </div>
  </nav>
</template>
