<script setup lang="ts">
import { AvatarFallback, AvatarImage, AvatarRoot } from 'reka-ui'
import { computed } from 'vue'

import { cn } from '../../lib/utils'
import { initialsOf } from './initials'
import { avatarVariants, imageClasses, tintClasses, unnamedClasses } from './styles'
import { avatarTint } from './tint'
import type { AvatarProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<AvatarProps>(), {
  src: undefined,
  size: 'md',
  class: undefined,
})

/* --------------------------------- State ---------------------------------- */

const initials = computed(() => initialsOf(props.name))
const tint = computed(() => tintOf(props.name))

/* -------------------------------- Helpers --------------------------------- */

function tintOf(name: string): string {
  if (name.trim().length === 0) return unnamedClasses
  return tintClasses[avatarTint(name) - 1]
}
</script>

<template>
  <AvatarRoot :class="cn(avatarVariants({ size: props.size }), tint, props.class)">
    <AvatarImage v-if="props.src" :src="props.src" :alt="props.name" :class="imageClasses" />
    <AvatarFallback :delay-ms="0">{{ initials }}</AvatarFallback>
  </AvatarRoot>
</template>
