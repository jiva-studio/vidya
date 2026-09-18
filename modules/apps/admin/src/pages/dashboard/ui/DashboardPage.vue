<script setup lang="ts">
import { EmptyState } from '@vidya/ui'
import { computed } from 'vue'

import { useSession } from '@/shared/session'

import { cardClasses, headerClasses, titleClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const { permissions } = useSession()

// A session that grants nothing anywhere is not an empty dashboard, it is an
// account nobody has given a role yet.
const grantsNothing = computed(() => permissions.value.every((entry) => entry.p.length === 0))
</script>

<template>
  <section>
    <header :class="headerClasses">
      <h1 :class="titleClasses">{{ $t('page-dashboard-title') }}</h1>
    </header>
    <EmptyState
      v-if="grantsNothing"
      :title="$t('page-dashboard-no-access-title')"
      :description="$t('page-dashboard-no-access-body')"
    />
    <div v-else :class="cardClasses">{{ $t('page-dashboard-empty') }}</div>
  </section>
</template>
