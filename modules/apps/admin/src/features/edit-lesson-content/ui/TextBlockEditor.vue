<script setup lang="ts">
import { Textarea } from '@vidya/ui'
import type { ComponentPublicInstance } from 'vue'
import { computed, nextTick, ref } from 'vue'

import MarkdownText from './MarkdownText.vue'
import { fieldStackClasses, hintClasses, placeholderClasses, readableClasses } from './styles'
import type { TextBlockEditorEmits, TextBlockEditorProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<TextBlockEditorProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<TextBlockEditorEmits>()

/* --------------------------------- State ---------------------------------- */

const area = ref<ComponentPublicInstance | null>(null)

const filled = computed(() => props.block.content.trim().length > 0)
const rows = computed(() => Math.min(Math.max(props.block.content.split('\n').length + 1, 3), 16))

// A block with nothing in it has nothing to read, so it opens as what it is:
// a place to write. Everything else shows the text and turns into a field when
// the author asks for one.
const editing = ref(!props.frozen && !filled.value)

/* -------------------------------- Handlers -------------------------------- */

function onOpen() {
  if (props.frozen) return
  editing.value = true
  void nextTick(focusArea)
}

function onClose() {
  editing.value = false
}

function onContent(content: string) {
  emit('update', { ...props.block, content })
}

/* -------------------------------- Helpers --------------------------------- */

function focusArea() {
  const element = area.value?.$el
  if (element instanceof HTMLTextAreaElement) element.focus()
}
</script>

<template>
  <MarkdownText v-if="props.frozen" :markdown="props.block.content" />
  <div v-else-if="editing" :class="fieldStackClasses">
    <Textarea
      ref="area"
      :model-value="props.block.content"
      :rows="rows"
      :aria-label="$t('editor-text-label')"
      :placeholder="$t('editor-text-placeholder')"
      @update:model-value="onContent"
      @blur="onClose"
    />
    <p :class="hintClasses">{{ $t('editor-text-hint') }}</p>
  </div>
  <div
    v-else
    role="button"
    tabindex="0"
    :class="readableClasses"
    :aria-label="$t('editor-text-edit')"
    @click="onOpen"
    @keydown.enter.prevent="onOpen"
    @keydown.space.prevent="onOpen"
  >
    <MarkdownText v-if="filled" :markdown="props.block.content" />
    <p v-else :class="placeholderClasses">{{ $t('editor-text-placeholder') }}</p>
  </div>
</template>
