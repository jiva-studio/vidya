<script setup lang="ts">
import type { LessonSection } from '@vidya/domain'
import { useFluent } from 'fluent-vue'
import { GraduationCap, Wand2 } from 'lucide-vue-next'
import type { Component } from 'vue'
import { computed, nextTick, ref, watch } from 'vue'

import type { MoveDirection } from '@/features/edit-lesson-content'

import SectionMenu from './SectionMenu.vue'
import {
  assessmentClasses,
  assessmentIconClasses,
  sectionHeaderClasses,
  sectionTitleClasses,
} from './styles'
import type { SectionHeaderEmits, SectionHeaderProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SectionHeaderProps>(), {
  frozen: false,
  autofocus: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SectionHeaderEmits>()

/* --------------------------------- State ---------------------------------- */

// Marking a section by machine means marking its questions; a section without
// one would be handed in and never come back.
const gradable = computed(() => props.section.blocks.some((block) => block.type === 'quiz'))

// Whether a section is handed in, and who marks it, is a property of the lesson
// as much as its text is: a menu nobody opened says nothing about the section
// they are reading. A section nobody has to hand in says nothing here either.
const marks: Partial<Record<LessonSection['assessment'], { icon: Component; label: string }>> = {
  auto: { icon: Wand2, label: 'editor-homework-auto' },
  teacher: { icon: GraduationCap, label: 'editor-homework-teacher' },
}

const marked = computed(() => marks[props.section.assessment])

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const title = ref<HTMLInputElement | null>(null)

const name = computed(() => props.section.title)

/* --------------------------------- Hooks ---------------------------------- */

watch(
  () => props.autofocus,
  (wanted) => {
    if (wanted) void nextTick(() => title.value?.focus())
  },
  { immediate: true, flush: 'post' },
)

/* -------------------------------- Handlers -------------------------------- */

function onInput(event: Event) {
  emit('rename', (event.target as HTMLInputElement).value)
}

function onMove(delta: MoveDirection) {
  emit('move', delta)
}

function onRemove() {
  emit('remove')
}

function onAssessment(assessment: LessonSection['assessment']) {
  emit('assessment', assessment)
}
</script>

<template>
  <header data-section-handle :class="sectionHeaderClasses">
    <h2 v-if="props.frozen" :class="sectionTitleClasses">
      {{ name || $t('editor-section-untitled') }}
    </h2>
    <input
      v-else
      ref="title"
      :value="name"
      :class="sectionTitleClasses"
      :aria-label="$t('editor-section-title-label')"
      :placeholder="$t('editor-section-untitled')"
      @input="onInput"
    />
    <span v-if="marked" :class="assessmentClasses">
      <component :is="marked.icon" :class="assessmentIconClasses" />
      {{ $t(marked.label) }}
    </span>
    <SectionMenu
      v-if="!props.frozen"
      :label="$t('editor-section-menu')"
      :assessment="props.section.assessment"
      :gradable="gradable"
      :first="props.first"
      :last="props.last"
      @move="onMove"
      @remove="onRemove"
      @assessment="onAssessment"
    />
  </header>
</template>
