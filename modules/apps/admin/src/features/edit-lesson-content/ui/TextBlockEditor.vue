<script setup lang="ts">
import { MarkdownText } from '@vidya/ui'
import { computed, ref } from 'vue'

import { stepToNeighbourField } from '../lib'
import type { MoveDirection } from '../types'
import { placeholderClasses, sourceClasses, textStackClasses } from './styles'
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
  onStep: onStep,
  onEnd: onEnd,
})

// The author holds the markdown itself, highlighted where it is typed: a block
// that rendered itself whenever the caret left would change height under the
// pointer, and a line that moves while you reach for it is worse than one that
// never pretends to be the finished page.
const empty = computed(() => !filled.value)

/* -------------------------------- Handlers -------------------------------- */

function onContent(text: string) {
  emit('update', { ...props.block, content: text })
}

function onStep(delta: MoveDirection): boolean {
  const surface = host.value?.querySelector<HTMLElement>('.cm-content')
  return surface ? stepToNeighbourField(surface, delta) : false
}

function onEnd(kept: string) {
  emit('end', kept)
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
    <p v-show="empty" :class="placeholderClasses">{{ $t('editor-text-placeholder') }}</p>
    <div ref="host" :class="sourceClasses" />
  </div>
</template>
