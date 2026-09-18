<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { bodyClasses, linkClasses, pageClasses, titleClasses } from './styles'
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('page-not-found-title') }}</h1>
    <p :class="bodyClasses">{{ $t('page-not-found-body') }}</p>
    <RouterLink :class="linkClasses" :to="{ name: 'dashboard' }">
      {{ $t('page-not-found-back') }}
    </RouterLink>
  </section>
</template>
