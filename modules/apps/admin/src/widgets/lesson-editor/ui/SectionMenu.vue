<script setup lang="ts">
import type { LessonSection } from '@vidya/domain'
import { Button, Popover } from '@vidya/ui'
import { MoreHorizontal } from 'lucide-vue-next'
import { ref } from 'vue'

import type { MoveDirection } from '@/features/edit-lesson-content'

import { menuClasses, menuHeadingClasses, menuItemClasses, menuTriggerClasses } from './styles'
import type { SectionMenuEmits, SectionMenuProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<SectionMenuProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SectionMenuEmits>()

/* --------------------------------- State ---------------------------------- */

const open = ref(false)

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

function onNone() {
  onAssessment('none')
}

function onAuto() {
  onAssessment('auto')
}

function onTeacher() {
  onAssessment('teacher')
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
    <div :class="menuClasses">
      <Button variant="ghost" :class="menuItemClasses" :disabled="props.first" @click="onUp">
        {{ $t('editor-move-up') }}
      </Button>
      <Button variant="ghost" :class="menuItemClasses" :disabled="props.last" @click="onDown">
        {{ $t('editor-move-down') }}
      </Button>
      <Button variant="ghost" :class="menuItemClasses" @click="onRemove">
        {{ $t('editor-delete') }}
      </Button>
      <p :class="menuHeadingClasses">{{ $t('editor-homework-label') }}</p>
      <Button variant="ghost" :class="menuItemClasses" @click="onNone">
        {{ $t('editor-homework-none') }}
      </Button>
      <Button variant="ghost" :class="menuItemClasses" @click="onAuto">
        {{ $t('editor-homework-auto') }}
      </Button>
      <Button variant="ghost" :class="menuItemClasses" @click="onTeacher">
        {{ $t('editor-homework-teacher') }}
      </Button>
    </div>
  </Popover>
</template>
