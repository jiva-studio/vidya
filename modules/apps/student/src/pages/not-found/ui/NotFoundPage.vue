<script setup lang="ts">
import { mutedClasses, pageClasses, titleClasses } from '@/shared/ui'
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('not-found-title') }}</h1>
    <p :class="mutedClasses">{{ $t('not-found-text') }}</p>
  </section>
</template>
