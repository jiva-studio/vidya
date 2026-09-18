<script setup lang="ts">
import { computed, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import { LanguageSwitch } from '@/features/switch-language'
import { useCurrentSchool } from '@/shared/access'
import { useSession } from '@/shared/session'
import { AppShell } from '@/widgets/app-shell'
import { SchoolSwitcher } from '@/widgets/school-switcher'
import { SidebarNav } from '@/widgets/sidebar-nav'

import { sectionMenu } from './sections'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()
const router = useRouter()
const session = useSession()
const { generation } = useCurrentSchool()

const groups = sectionMenu()

// Sign-in and anything else outside the shell says so on its route, rather
// than the shell guessing from the path.
const withChrome = computed(() => route.meta.chrome !== false && session.isSignedIn.value)

/* --------------------------------- Hooks ---------------------------------- */

// A screen addressed by an identifier belongs to the school it was opened in:
// one course, one group, one person. When the school changes, that record is
// not there to be looked at, so the operator is put back on the section's index
// — the lists reload themselves and need no such help (AC-6).
watch(generation, () => {
  if (Object.keys(route.params).length === 0) return
  void router.replace({ name: route.meta.section ?? 'dashboard' })
})

/* -------------------------------- Handlers -------------------------------- */

function onSignOut() {
  session.end()
  void router.replace({ name: 'login' })
}
</script>

<template>
  <AppShell v-if="withChrome" @sign-out="onSignOut">
    <template #school><SchoolSwitcher /></template>
    <template #nav><SidebarNav :groups="groups" /></template>
    <template #profile><LanguageSwitch /></template>
    <RouterView />
  </AppShell>
  <RouterView v-else />
</template>
