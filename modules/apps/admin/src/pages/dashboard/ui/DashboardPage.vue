<script setup lang="ts">
import type { PermissionKey } from '@vidya/domain'
import { EmptyState } from '@vidya/ui'
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import { useCurrentSchool } from '@/shared/access'
import { grants, useSession } from '@/shared/session'

import { islandsFor, useWorkload } from '../model'
import DashboardIslandCard from './DashboardIslandCard.vue'
import { gridClasses, headerClasses, pageClasses, titleClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const router = useRouter()
const { permissions } = useSession()
const { schoolId } = useCurrentSchool()
const workload = useWorkload()

// A session that grants nothing anywhere is not an empty dashboard, it is an
// account nobody has given a role yet.
const grantsNothing = computed(() => permissions.value.every((entry) => entry.p.length === 0))

const islands = computed(() => islandsFor(granted, workload.counts.value))

/* --------------------------------- Hooks ---------------------------------- */

onMounted(() => {
  void workload.load()
})

/* -------------------------------- Handlers -------------------------------- */

function onOpen(route: string) {
  void router.push({ name: route })
}

/* -------------------------------- Helpers --------------------------------- */

// `useCan` answers one fixed permission; the islands ask about several, and
// asking through the same function is what keeps the home screen and the menu
// from disagreeing about what a role allows.
function granted(permission: PermissionKey): boolean {
  return grants(permissions.value, schoolId.value, permission)
}
</script>

<template>
  <section :class="pageClasses">
    <header :class="headerClasses">
      <h1 :class="titleClasses">{{ $t('page-dashboard-title') }}</h1>
    </header>
    <EmptyState
      v-if="grantsNothing"
      :title="$t('page-dashboard-no-access-title')"
      :description="$t('page-dashboard-no-access-body')"
    />
    <EmptyState
      v-else-if="islands.length === 0"
      :title="$t('page-dashboard-nothing-title')"
      :description="$t('page-dashboard-empty')"
    />
    <div v-else :class="gridClasses">
      <DashboardIslandCard
        v-for="island in islands"
        :key="island.key"
        :island="island"
        :loading="workload.loading.value"
        @open="onOpen"
      />
    </div>
  </section>
</template>
