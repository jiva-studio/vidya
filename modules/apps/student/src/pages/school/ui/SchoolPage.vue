<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import { mutedClasses, pageClasses, titleClasses } from '@/shared/ui'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()

const code = computed(() => String(route.params.code ?? ''))
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('school-title', { code }) }}</h1>
    <p :class="mutedClasses">{{ $t('school-empty') }}</p>
  </section>
</template>
