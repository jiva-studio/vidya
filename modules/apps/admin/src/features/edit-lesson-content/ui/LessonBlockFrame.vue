<script setup lang="ts">
import type { LessonBlock } from '@vidya/domain'
import { useFluent } from 'fluent-vue'
import { computed, nextTick, ref, watch } from 'vue'

import { atFieldEdge, blockAnchorOf, stepToNeighbourField } from '../lib'
import { useIsFaulted } from '../model'
import type { BlockType, MoveDirection } from '../types'
import BlockHandle from './BlockHandle.vue'
import BlockInserter from './BlockInserter.vue'
import LessonBlockEditor from './LessonBlockEditor.vue'
import { blockBodyClasses, blockFaultClasses, blockFrameClasses, gutterClasses } from './styles'
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

const faulted = useIsFaulted(() => props.block.id)
const frameClasses = computed(() => [blockFrameClasses, faulted.value ? blockFaultClasses : []])

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

function onSection() {
  dismiss()
  emit('insert-section')
}

function onEnd(kept: string) {
  emit('end', kept)
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

// Only what the block left unhandled: an editor that moved its own caret has
// already said the key was for it.
function onKey(event: KeyboardEvent) {
  if (event.defaultPrevented) return

  const delta = arrowDelta(event.key)
  if (!delta || !atFieldEdge(event.target, delta)) return
  if (event.target instanceof HTMLElement && stepToNeighbourField(event.target, delta)) {
    event.preventDefault()
  }
}

function onSlash() {
  insertOpen.value = true
}

function onEscape() {
  insertOpen.value = false
}

/* -------------------------------- Helpers --------------------------------- */

function arrowDelta(key: string): MoveDirection | undefined {
  if (key === 'ArrowUp') return -1
  if (key === 'ArrowDown') return 1
  return undefined
}

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
    :id="blockAnchorOf(props.block.id)"
    :data-block-id="props.block.id"
    data-block-frame
    :aria-invalid="faulted || undefined"
    :class="frameClasses"
    @mouseenter="onEnter"
    @mouseleave="onLeave"
    @focusin="onFocusIn"
    @focusout="onFocusOut"
    @keydown="onKey"
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
    </div>
    <div ref="body" tabindex="-1" :class="blockBodyClasses">
      <LessonBlockEditor
        :block="props.block"
        :frozen="props.frozen"
        @update="onUpdate"
        @slash="onSlash"
        @escape="onEscape"
        @end="onEnd"
      />
    </div>
    <BlockInserter
      v-if="!props.frozen"
      :open="insertOpen"
      @update:open="onInsertOpen"
      @pick="onPick"
      @section="onSection"
    />
  </div>
</template>
