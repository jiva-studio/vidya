<script setup lang="ts">
import { mutedClasses, pageClasses, titleClasses } from '@/shared/ui'
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('course-title') }}</h1>
    <p :class="mutedClasses">{{ $t('school-empty') }}</p>
  </section>
</template>
