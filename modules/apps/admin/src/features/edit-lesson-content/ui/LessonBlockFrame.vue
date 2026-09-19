<script setup lang="ts">
import type { LessonBlock } from '@vidya/domain'
import { useFluent } from 'fluent-vue'
import { computed, nextTick, ref, watch } from 'vue'

import type { BlockType, MoveDirection } from '../types'
import BlockHandle from './BlockHandle.vue'
import BlockInserter from './BlockInserter.vue'
import LessonBlockEditor from './LessonBlockEditor.vue'
import { blockBodyClasses, blockFrameClasses, gutterClasses } from './styles'
import type { LessonBlockFrameEmits, LessonBlockFrameProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<LessonBlockFrameProps>(), {
  frozen: false,
  autofocus: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<LessonBlockFrameEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const body = ref<HTMLElement | null>(null)
const hovered = ref(false)
const focused = ref(false)
const menuOpen = ref(false)
const insertOpen = ref(false)

// A menu opened from this block keeps the gutter alive: the trigger is inside
// the chrome it opened, and a gutter that vanished would take the open menu
// down with it the moment focus left for the overlay.
const chrome = computed(
  () => !props.frozen && (hovered.value || focused.value || menuOpen.value || insertOpen.value),
)

/* --------------------------------- Hooks ---------------------------------- */

// Immediate, because a block inserted below the caret is mounted already asking
// for it: by the time a watcher could see the flag change, it has always been set.
watch(
  () => props.autofocus,
  (wanted) => {
    if (wanted) void nextTick(focusInside)
  },
  { immediate: true, flush: 'post' },
)

/* -------------------------------- Handlers -------------------------------- */

function onEnter() {
  hovered.value = true
}

function onLeave() {
  hovered.value = false
}

function onFocusIn() {
  focused.value = true
}

function onFocusOut() {
  focused.value = false
}

function onMenuOpen(open: boolean) {
  menuOpen.value = open
}

function onInsertOpen(open: boolean) {
  insertOpen.value = open
}

function onPick(type: BlockType) {
  dismiss()
  emit('insert', type)
}

function onMove(delta: MoveDirection) {
  dismiss()
  emit('move', delta)
}

function onDuplicate() {
  dismiss()
  emit('duplicate')
}

function onRemove() {
  dismiss()
  emit('remove')
}

function onUpdate(block: LessonBlock) {
  emit('update', block)
}

function onSlash() {
  insertOpen.value = true
}

function onEscape() {
  insertOpen.value = false
}

/* -------------------------------- Helpers --------------------------------- */

// The gutter goes down with the menu it opened. An overlay hands focus back to
// the button it was opened from as it closes, and this block is no longer where
// the caret belongs — the edit just sent it somewhere else.
function dismiss() {
  menuOpen.value = false
  insertOpen.value = false
  hovered.value = false
  focused.value = false
}

// Focus is delegated rather than described: every kind of block has a different
// first field, and one that has none is still somewhere the caret can rest.
function focusInside() {
  const host = body.value
  if (!host) return

  const field = host.querySelector<HTMLElement>('[contenteditable], textarea, input, button')
  ;(field ?? host).focus()
}
</script>

<template>
  <div
    :data-block-id="props.block.id"
    :class="blockFrameClasses"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
  >
    <div v-if="chrome" :class="gutterClasses">
      <BlockHandle
        :open="menuOpen"
        :label="$t('editor-block-menu')"
        :first="props.first"
        :last="props.last"
        @update:open="onMenuOpen"
        @move="onMove"
        @duplicate="onDuplicate"
        @remove="onRemove"
      />
      <BlockInserter
        :open="insertOpen"
        :label="$t('editor-block-add')"
        @update:open="onInsertOpen"
        @pick="onPick"
      />
    </div>
    <div ref="body" tabindex="-1" :class="blockBodyClasses">
      <LessonBlockEditor
        :block="props.block"
        :frozen="props.frozen"
        @update="onUpdate"
        @slash="onSlash"
        @escape="onEscape"
      />
    </div>
  </div>
</template>
