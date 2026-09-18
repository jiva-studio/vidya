<template>
  <div
    class="ion-padding-start ion-padding-end"
    v-html="renderedContent"
  />
</template>

<script lang="ts" setup>
import type { TextBlock } from '@vidya/protocol'
import { Marked } from '@ts-stack/markdown'
import { computed } from 'vue'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<{ block: TextBlock }>()

/* --------------------------------- State ---------------------------------- */

const renderedContent = computed(() => Marked.parse(props.block.content))
</script>
