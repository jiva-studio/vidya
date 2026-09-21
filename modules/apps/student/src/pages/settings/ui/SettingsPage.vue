<script setup lang="ts">
import { pageClasses, titleClasses } from '@/shared/ui'

import SyncState from './SyncState.vue'
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('settings-title') }}</h1>
    <SyncState />
  </section>
</template>
