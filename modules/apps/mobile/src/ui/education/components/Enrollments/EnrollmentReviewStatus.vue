<template>
  <ImageAndButtonLayout :image="image" :action="actionText" @click="onButtonClicked">
    <h1>{{ header }}</h1>
    {{ text }}
  </ImageAndButtonLayout>
</template>

<script setup lang="ts">
import { ImageAndButtonLayout } from '@/design'
import type { EnrollmentReviewStatusEmits, EnrollmentReviewStatusProps } from './types'

/* --------------------------------- Props ---------------------------------- */

// Cancelling a request is not offered: the API has no route a student may call
// to withdraw one. Recorded as a deficit rather than faked here.
defineProps<EnrollmentReviewStatusProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<EnrollmentReviewStatusEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onButtonClicked() {
  emit('click')
}
</script>
