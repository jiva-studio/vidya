<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import { LanguageSwitch } from '@/features/switch-language'
import { useSession } from '@/shared/session'
import { AppShell } from '@/widgets/app-shell'
import { SchoolSwitcher } from '@/widgets/school-switcher'
import { SidebarNav } from '@/widgets/sidebar-nav'

import { sectionMenu } from './sections'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()
const router = useRouter()
const session = useSession()

const groups = sectionMenu()

// Sign-in and anything else outside the shell says so on its route, rather
// than the shell guessing from the path.
const withChrome = computed(() => route.meta.chrome !== false && session.isSignedIn.value)

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
