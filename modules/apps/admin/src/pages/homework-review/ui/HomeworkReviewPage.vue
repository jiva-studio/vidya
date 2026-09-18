<script setup lang="ts">
import { PageHeader } from '@vidya/ui'

import { HomeworkReviewPane } from '@/widgets/homework-review-pane'

import { sectionClasses } from './styles'
import type { HomeworkReviewPageProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<HomeworkReviewPageProps>()
</script>

<template>
  <section :class="sectionClasses">
    <PageHeader
      :title="$t('homework-review-title')"
      :description="$t('homework-review-description')"
    />
    <HomeworkReviewPane :initial-id="props.id" />
  </section>
</template>
