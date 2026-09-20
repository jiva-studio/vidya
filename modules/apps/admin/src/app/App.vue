<script setup lang="ts">
import type { UserId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { computed, ref, watch } from 'vue'
import { RouterView, useRoute, useRouter } from 'vue-router'

import { Toaster } from '@vidya/ui'

import { useUserApi } from '@/entities/user'
import { useToasts } from '@/shared/lib'
import { useSession } from '@/shared/session'
import { AccountMenu } from '@/widgets/account-menu'
import { AppShell } from '@/widgets/app-shell'
import { SchoolSwitcher } from '@/widgets/school-switcher'
import { SidebarNav } from '@/widgets/sidebar-nav'

import { sectionMenu } from './sections'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()
const router = useRouter()
const session = useSession()
const userApi = useUserApi()
const toasts = useToasts()

const groups = sectionMenu()
const profileName = ref<string | undefined>(undefined)
const profileEmail = ref<string | undefined>(undefined)

watch(
  () => session.userId.value,
  async (id) => {
    if (!id) {
      profileName.value = undefined
      profileEmail.value = undefined
      return
    }
    try {
      const user = await userApi.nameOf(asId<UserId>(id))
      profileName.value = user.name || user.email || undefined
      profileEmail.value = user.email || undefined
    } catch {
      profileName.value = undefined
      profileEmail.value = undefined
    }
  },
  { immediate: true },
)

const userName = computed(() => profileName.value || 'Admin')
const userEmail = computed(() => profileEmail.value)

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
    <template #profile>
      <AccountMenu :name="userName" :email="userEmail" @sign-out="onSignOut" />
    </template>
    <RouterView />
  </AppShell>
  <RouterView v-else />
  <Toaster :toasts="toasts.items.value" @dismiss="toasts.dismiss" />
</template>
