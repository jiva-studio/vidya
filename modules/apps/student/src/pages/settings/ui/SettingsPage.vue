<script setup lang="ts">
import { pageClasses, titleClasses } from '@/shared/ui'

import MySchools from './MySchools.vue'
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('settings-title') }}</h1>
    <MySchools />
  </section>
</template>
