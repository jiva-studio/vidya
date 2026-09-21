<script setup lang="ts">
import { useFluent } from 'fluent-vue'
import { ChevronLeft } from 'lucide-vue-next'
import { computed } from 'vue'
import { RouterLink, useRoute } from 'vue-router'

import { useCurrentSchool } from '@/shared/access'
import type { NavPlacement } from '@/shared/navigation'

import { backClasses, backIconClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const route = useRoute()
const { schoolId } = useCurrentSchool()

// A page reached through a record has somewhere to go back to, and saying so
// on the page is what the sidebar entry cannot do: the reader is looking here.
const placement = computed<NavPlacement | undefined>(
  () => route.meta.nav as NavPlacement | undefined,
)

const to = computed(() => ({
  name: placement.value?.parent ?? '',
  params: { schoolId: schoolId.value },
}))

const label = computed(() => $t(`nav-${placement.value?.parent}`))
</script>

<template>
  <RouterLink v-if="placement" :class="backClasses" :to="to" :aria-label="label" :title="label">
    <ChevronLeft :class="backIconClasses" />
  </RouterLink>
</template>
