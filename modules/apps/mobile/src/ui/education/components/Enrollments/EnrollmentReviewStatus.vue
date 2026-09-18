<template>
  <ImageAndButtonLayout
    :image="image"
    :action="actionText"
    @click="onButtonClicked"
  >
    <h1>{{ header }}</h1>
    {{ text }}
  </ImageAndButtonLayout>
</template>

<script setup lang="ts">
import { ImageAndButtonLayout } from '@/design'

/* --------------------------------- Props ---------------------------------- */

// Cancelling a request is not offered: the API has no route a student may call
// to withdraw one. Recorded as a deficit rather than faked here.
defineProps<{
  image: string
  header: string
  text: string
  actionText: string
}>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<{ click: [] }>()

/* -------------------------------- Handlers -------------------------------- */

function onButtonClicked() {
  emit('click')
}
</script>
