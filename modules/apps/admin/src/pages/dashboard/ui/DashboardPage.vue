<script setup lang="ts">
import { cardClasses, headerClasses, subtitleClasses, titleClasses } from './styles'
</script>

<template>
  <section>
    <header :class="headerClasses">
      <h1 :class="titleClasses">{{ $t('page-dashboard-title') }}</h1>
      <p :class="subtitleClasses">{{ $t('page-dashboard-subtitle') }}</p>
    </header>
    <div :class="cardClasses">{{ $t('state-empty') }}</div>
  </section>
</template>
