<script setup lang="ts">
import { PageHeader } from '@vidya/ui'

import { HomeworkReviewPane } from '@/widgets/homework-review-pane'

import { sectionClasses } from './styles'
</script>

<template>
  <section :class="sectionClasses">
    <PageHeader :title="$t('homework-title')" :description="$t('homework-description')" />
    <HomeworkReviewPane />
  </section>
</template>
