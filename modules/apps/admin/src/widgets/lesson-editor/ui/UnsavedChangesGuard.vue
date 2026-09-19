<script setup lang="ts">
import { AlertDialog } from '@vidya/ui'
import { nextTick, onBeforeUnmount, onMounted } from 'vue'
import { ref } from 'vue'
import type { NavigationGuardNext } from 'vue-router'
import { onBeforeRouteLeave } from 'vue-router'

import type { UnsavedChangesGuardProps } from './types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<UnsavedChangesGuardProps>(), { dirty: false })

/* --------------------------------- State ---------------------------------- */

const open = ref(false)

// The navigation being held. It is not cleared when the dialog closes, because
// confirming closes the dialog too and the order of the two events is reka's.
let held: NavigationGuardNext | undefined

/* --------------------------------- Hooks ---------------------------------- */

onBeforeRouteLeave((_to, _from, next) => {
  if (!props.dirty) {
    next()
    return
  }

  held = next
  open.value = true
})

onMounted(() => window.addEventListener('beforeunload', onBeforeUnload))
onBeforeUnmount(() => window.removeEventListener('beforeunload', onBeforeUnload))

/* -------------------------------- Handlers -------------------------------- */

function onLeave() {
  open.value = false
  release(true)
}

function onStay() {
  open.value = false
  release(false)
}

// Escape and the overlay close the dialog without either button; a tick later
// is when it is safe to read that nobody answered.
function onOpenChange(value: boolean) {
  open.value = value
  if (value) return
  void nextTick(() => {
    if (held) release(false)
  })
}

function onBeforeUnload(event: BeforeUnloadEvent) {
  if (!props.dirty) return
  event.preventDefault()
  event.returnValue = ''
}

/* -------------------------------- Helpers --------------------------------- */

function release(leave: boolean) {
  const proceed = held
  held = undefined
  if (!proceed) return
  if (leave) proceed()
  else proceed(false)
}
</script>

<template>
  <AlertDialog
    :open="open"
    :title="$t('editor-unsaved-title')"
    :description="$t('editor-unsaved-body')"
    :confirm-label="$t('editor-unsaved-leave')"
    :cancel-label="$t('editor-unsaved-stay')"
    destructive
    @confirm="onLeave"
    @cancel="onStay"
    @update:open="onOpenChange"
  />
</template>
