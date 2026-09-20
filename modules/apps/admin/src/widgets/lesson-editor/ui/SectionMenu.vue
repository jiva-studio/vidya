<script setup lang="ts">
import type { LessonSection } from '@vidya/domain'
import { Button, Popover } from '@vidya/ui'
import {
  ArrowDown,
  ArrowUp,
  Ban,
  Check,
  GraduationCap,
  MoreHorizontal,
  Trash2,
  Wand2,
} from 'lucide-vue-next'
import { computed, ref } from 'vue'

import type { MoveDirection } from '@/features/edit-lesson-content'
import { useMenuKeys } from '@/features/edit-lesson-content'

import {
  menuCheckClasses,
  menuClasses,
  menuHeadingClasses,
  menuIconClasses,
  menuItemClasses,
  menuSeparatorClasses,
  menuTriggerClasses,
} from './styles'
import type { SectionMenuEmits, SectionMenuProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<SectionMenuProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SectionMenuEmits>()

/* --------------------------------- State ---------------------------------- */

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const choices = computed(() => [
  { value: 'none' as const, label: 'editor-homework-none', icon: Ban, allowed: true },
  { value: 'auto' as const, label: 'editor-homework-auto', icon: Wand2, allowed: props.gradable },
  {
    value: 'teacher' as const,
    label: 'editor-homework-teacher',
    icon: GraduationCap,
    allowed: true,
  },
])

/* --------------------------------- Hooks ---------------------------------- */

const { onKey } = useMenuKeys(root)

/* -------------------------------- Handlers -------------------------------- */

function onOpen(next: boolean) {
  open.value = next
}

function onEnter() {
  open.value = true
}

function onUp() {
  open.value = false
  emit('move', -1 as MoveDirection)
}

function onDown() {
  open.value = false
  emit('move', 1 as MoveDirection)
}

function onRemove() {
  open.value = false
  emit('remove')
}

function onAssessment(assessment: LessonSection['assessment']) {
  open.value = false
  emit('assessment', assessment)
}
</script>

<template>
  <Popover :open="open" :label="props.label" align="end" @update:open="onOpen">
    <template #trigger>
      <button
        type="button"
        :aria-label="props.label"
        :class="menuTriggerClasses"
        @keydown.enter.prevent="onEnter"
      >
        <MoreHorizontal />
      </button>
    </template>
    <div ref="root" :class="menuClasses" @keydown="onKey">
      <Button variant="ghost" :class="menuItemClasses" :disabled="props.first" @click="onUp">
        <ArrowUp :class="menuIconClasses" />
        {{ $t('editor-move-up') }}
      </Button>
      <Button variant="ghost" :class="menuItemClasses" :disabled="props.last" @click="onDown">
        <ArrowDown :class="menuIconClasses" />
        {{ $t('editor-move-down') }}
      </Button>
      <Button variant="ghost" :class="menuItemClasses" @click="onRemove">
        <Trash2 :class="menuIconClasses" />
        {{ $t('editor-delete') }}
      </Button>
      <div :class="menuSeparatorClasses" />
      <p :class="menuHeadingClasses">{{ $t('editor-homework-label') }}</p>
      <Button
        v-for="choice in choices"
        :key="choice.value"
        variant="ghost"
        :class="menuItemClasses"
        :disabled="!choice.allowed"
        :title="choice.allowed ? undefined : $t('editor-homework-needs-quiz')"
        @click="onAssessment(choice.value)"
      >
        <component :is="choice.icon" :class="menuIconClasses" />
        {{ $t(choice.label) }}
        <Check
          :class="menuCheckClasses"
          :data-on="choice.value === props.assessment || undefined"
        />
      </Button>
    </div>
  </Popover>
</template>
