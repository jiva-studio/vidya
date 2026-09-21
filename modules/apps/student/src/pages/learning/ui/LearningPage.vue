<script setup lang="ts">
import { mutedClasses, pageClasses, titleClasses } from '@/shared/ui'
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('learning-title') }}</h1>
    <p :class="mutedClasses">{{ $t('learning-empty') }}</p>
  </section>
</template>
