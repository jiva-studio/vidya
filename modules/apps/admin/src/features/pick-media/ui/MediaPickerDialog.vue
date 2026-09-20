<script setup lang="ts">
import { Dialog, Tabs, TabsPanel } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'

import type { PickedMedia } from '@/entities/media'

import MediaLibraryPanel from './MediaLibraryPanel.vue'
import MediaUploadPanel from './MediaUploadPanel.vue'
import type { MediaPickerDialogEmits, MediaPickerDialogProps } from '../types'
import { MediaPickerTabs } from '../types'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<MediaPickerDialogProps>(), {
  open: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<MediaPickerDialogEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const tab = ref<string>(MediaPickerTabs[0])
const items = computed(() =>
  MediaPickerTabs.map((value) => ({ value, label: $t(`media-picker-tab-${value}`) })),
)

/* -------------------------------- Handlers -------------------------------- */

function onOpen(open: boolean) {
  emit('update:open', open)
}

function onTab(value: string) {
  tab.value = value
}

function onPick(picked: PickedMedia) {
  hand(picked)
}

/* -------------------------------- Helpers --------------------------------- */

// Choosing a file is the whole point of the dialog, so it closes itself rather
// than leaving the author to dismiss a dialog whose work is done.
function hand(picked: PickedMedia) {
  emit('pick', picked)
  emit('update:open', false)
}
</script>

<template>
  <Dialog
    :open="props.open"
    size="lg"
    :title="$t('media-picker-title')"
    :close-label="$t('media-picker-close')"
    @update:open="onOpen"
  >
    <Tabs
      :model-value="tab"
      :items="items"
      :label="$t('media-picker-title')"
      @update:model-value="onTab"
    >
      <TabsPanel value="upload">
        <MediaUploadPanel :kind="props.kind" :accept="props.accept" @pick="onPick" />
      </TabsPanel>
      <TabsPanel value="library">
        <MediaLibraryPanel :kind="props.kind" @pick="onPick" />
      </TabsPanel>
    </Tabs>
  </Dialog>
</template>
