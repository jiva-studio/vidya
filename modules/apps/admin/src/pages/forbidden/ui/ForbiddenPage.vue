<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { bodyClasses, linkClasses, pageClasses, titleClasses } from './styles'
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('page-forbidden-title') }}</h1>
    <p :class="bodyClasses">{{ $t('page-forbidden-body') }}</p>
    <RouterLink :class="linkClasses" :to="{ name: 'dashboard' }">
      {{ $t('page-forbidden-back') }}
    </RouterLink>
  </section>
</template>
