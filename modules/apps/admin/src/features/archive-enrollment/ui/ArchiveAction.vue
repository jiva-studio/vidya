<script setup lang="ts">
import { isLive } from '@vidya/domain'
import { AlertDialog, IconButton } from '@vidya/ui'
import { Archive } from 'lucide-vue-next'
import { computed, ref } from 'vue'

import type { ArchiveActionEmits, ArchiveActionProps } from '../types'
import { actionsClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<ArchiveActionProps>(), {
  canModerate: false,
  busy: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<ArchiveActionEmits>()

/* --------------------------------- State ---------------------------------- */

const asking = ref(false)

// A request that still holds a place is answered, not tidied away: the server
// refuses a stamp on a live row, and hiding one would leave the student waiting
// on a decision nobody can see is owed.
const canArchive = computed(() => props.canModerate && !isLive(props.enrollment.status))

/* -------------------------------- Handlers -------------------------------- */

function onAsked() {
  asking.value = true
}

function onConfirmed() {
  asking.value = false
  emit('archive', props.enrollment.id)
}
</script>

<template>
  <div :class="actionsClasses">
    <IconButton
      v-if="canArchive"
      variant="ghost"
      :label="$t('enrollments-archive')"
      :busy="props.busy"
      @click="onAsked"
    >
      <Archive />
    </IconButton>
    <AlertDialog
      v-model:open="asking"
      :title="$t('enrollments-archive-title')"
      :description="$t('enrollments-archive-consequence')"
      :confirm-label="$t('enrollments-archive')"
      :cancel-label="$t('action-cancel')"
      @confirm="onConfirmed"
    />
  </div>
</template>
