<script setup lang="ts">
import { Button } from '@vidya/ui'
import { CircleHelp, Image, Menu, Music, Type, Video } from 'lucide-vue-next'
import { ref } from 'vue'

import { useMenuKeys } from '../lib'

import type { BlockType } from '../types'
import { BlockTypes } from '../types'
import {
  menuClasses,
  menuIconClasses,
  menuItemClasses,
  menuSeparatorClasses,
} from './styles'
import type { BlockInsertMenuEmits } from './types'

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<BlockInsertMenuEmits>()

/* --------------------------------- State ---------------------------------- */

const icons = { text: Type, image: Image, video: Video, audio: Music, quiz: CircleHelp }

const root = ref<HTMLElement | null>(null)

/* --------------------------------- Hooks ---------------------------------- */

const { onKey } = useMenuKeys(root)

/* -------------------------------- Handlers -------------------------------- */

function onSelect(value: BlockType) {
  emit('pick', value)
}

function onSection() {
  emit('section')
}
</script>

<template>
  <div ref="root" :class="menuClasses" @keydown="onKey">
    <Button
      v-for="type in BlockTypes"
      :key="type"
      variant="ghost"
      :class="menuItemClasses"
      @click="onSelect(type)"
    >
      <component :is="icons[type]" :class="menuIconClasses" />
      {{ $t(`editor-block-${type}`) }}
    </Button>
    <div :class="menuSeparatorClasses" />
    <Button variant="ghost" :class="menuItemClasses" @click="onSection">
      <Menu :class="menuIconClasses" />
      {{ $t('editor-block-section') }}
    </Button>
  </div>
</template>
