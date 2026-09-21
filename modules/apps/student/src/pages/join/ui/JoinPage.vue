<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { mutedClasses, pageClasses, titleClasses } from '@/shared/ui'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()

// The public code of the school, never its identifier: this address is printed
// on paper and read aloud, and it is resolved by the server, not by the token.
const code = computed(() => String(route.params.code ?? ''))
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('join-title', { code }) }}</h1>
    <p :class="mutedClasses">{{ $t('join-empty') }}</p>
  </section>
</template>
