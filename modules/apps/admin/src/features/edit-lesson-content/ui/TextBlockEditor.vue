<script setup lang="ts">
import { computed, ref } from 'vue'

import MarkdownText from './MarkdownText.vue'
import { placeholderClasses, sourceClasses, sourceTuckedClasses, textStackClasses } from './styles'
import type { TextBlockEditorEmits, TextBlockEditorProps } from './types'
import { useMarkdownEditor } from './useMarkdownEditor'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<TextBlockEditorProps>(), { frozen: false })

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<TextBlockEditorEmits>()

/* --------------------------------- State ---------------------------------- */

const host = ref<HTMLElement | null>(null)

const content = computed(() => props.block.content)
const filled = computed(() => content.value.trim().length > 0)

const editor = useMarkdownEditor({
  host,
  doc: content,
  onChange: onContent,
  onSlash: onSlash,
  onEscape: onEscape,
})

// Reading and writing are the same block seen from two sides: the source is
// what the author is holding, the rendering is what the student will read.
const reading = computed(() => !editor.focused.value)

// The source is tucked away rather than unmounted while it is being read: an
// element behind `display: none` cannot take focus, and the caret has to be
// able to land here from a click, from a deletion and from the block above.
const sourceStateClasses = computed(() => (reading.value ? sourceTuckedClasses : sourceClasses))

/* -------------------------------- Handlers -------------------------------- */

function onContent(text: string) {
  emit('update', { ...props.block, content: text })
}

function onSlash() {
  emit('slash')
}

function onEscape() {
  emit('escape')
}

function onWrite() {
  editor.focus()
}
</script>

<template>
  <MarkdownText v-if="props.frozen" :markdown="content" />
  <div v-else :class="textStackClasses" @click="onWrite">
    <MarkdownText v-show="reading && filled" :markdown="content" />
    <p v-show="reading && !filled" :class="placeholderClasses">
      {{ $t('editor-text-placeholder') }}
    </p>
    <div ref="host" :class="sourceStateClasses" />
  </div>
</template>
