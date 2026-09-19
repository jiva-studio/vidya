<script setup lang="ts">
import { RouterLink } from 'vue-router'

import { bodyClasses, linkClasses, pageClasses, titleClasses } from './styles'

// The root rather than the dashboard by name: this screen is reached from an
// address that may name no school, and the guard knows which one to open.
const home = '/'
</script>

<template>
  <section :class="pageClasses">
    <h1 :class="titleClasses">{{ $t('page-forbidden-title') }}</h1>
    <p :class="bodyClasses">{{ $t('page-forbidden-body') }}</p>
    <RouterLink :class="linkClasses" :to="home">
      {{ $t('page-forbidden-back') }}
    </RouterLink>
  </section>
</template>
