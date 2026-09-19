<script setup lang="ts">
import type { LessonSection } from '@vidya/domain'
import { useFluent } from 'fluent-vue'
import { computed, nextTick, ref, watch } from 'vue'

import type { MoveDirection } from '@/features/edit-lesson-content'

import SectionMenu from './SectionMenu.vue'
import { sectionHeaderClasses, sectionTitleClasses } from './styles'
import type { SectionHeaderEmits, SectionHeaderProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<SectionHeaderProps>(), {
  frozen: false,
  autofocus: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<SectionHeaderEmits>()

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
    <SectionMenu
      v-if="!props.frozen"
      :label="$t('editor-section-menu')"
      :first="props.first"
      :last="props.last"
      @move="onMove"
      @remove="onRemove"
      @assessment="onAssessment"
    />
  </header>
</template>
