<script setup lang="ts">
import { pageClasses, titleClasses } from '@/shared/ui'

import MySchools from './MySchools.vue'
import SyncState from './SyncState.vue'
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('settings-title') }}</h1>
    <MySchools />
    <SyncState />
  </section>
</template>
