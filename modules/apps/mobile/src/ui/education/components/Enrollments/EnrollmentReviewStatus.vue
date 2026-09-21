<template>
  <ImageAndButtonLayout
    :image="image"
    :action="actionText"
    :danger-action="dangerActionText"
    :danger-action-alert="dangerActionAlert"
    @click="onButtonClicked"
  >
    <h1>{{ header }}</h1>
    {{ text }}
    <slot />
  </ImageAndButtonLayout>
</template>

<script setup lang="ts">
import { ImageAndButtonLayout } from '@/design'
import type { EnrollmentReviewStatusEmits, EnrollmentReviewStatusProps } from './types'

/* --------------------------------- Props ---------------------------------- */

withDefaults(defineProps<EnrollmentReviewStatusProps>(), {
  dangerActionText: undefined,
  dangerActionAlert: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<EnrollmentReviewStatusEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onButtonClicked(action: 'normal' | 'danger') {
  emit('click', action)
}
</script>
