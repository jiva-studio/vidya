<script setup lang="ts">
import { EmptyState, FailureState, Input, Pagination, Skeleton } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted, watch } from 'vue'

import type { MediaRecord } from '@/entities/media'
import { useMediaAddresses } from '@/entities/media'

import { useMediaLibrary } from '../model'
import MediaLibraryTile from './MediaLibraryTile.vue'
import { gridClasses, panelClasses } from './styles'
import type { MediaLibraryPanelEmits, MediaLibraryPanelProps } from '../types'

/* --------------------------------- Props ---------------------------------- */

const props = defineProps<MediaLibraryPanelProps>()

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<MediaLibraryPanelEmits>()

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()

const { addressOf, readListed } = useMediaAddresses()
const library = useMediaLibrary(props.kind)

const showing = computed(() => !library.loading.value && !library.error.value)
const empty = computed(() => showing.value && library.items.value.length === 0)
const paged = computed(() => showing.value && library.total.value > library.pageSize.value)

/* --------------------------------- Hooks ---------------------------------- */

onMounted(() => {
  void library.open()
})

// Every page of the library is one batch: a grid of dozens cannot ask per tile.
watch(library.items, (listed) => void readListed(listed))

/* -------------------------------- Handlers -------------------------------- */

function onSearch(term: string) {
  void library.search(term)
}

function onPage(page: number) {
  void library.open(page)
}

function onRetry() {
  void library.open(library.page.value)
}

function onPick(record: MediaRecord) {
  emit('pick', { url: record.url, source: 'upload', name: record.name })
}

/* -------------------------------- Helpers --------------------------------- */

// A file the server signed no address for falls back to the icon for its kind
// rather than to a broken image.
function srcOf(record: MediaRecord): string | undefined {
  return addressOf(record.url)
}
</script>

<template>
  <div :class="panelClasses">
    <Input
      :model-value="library.term.value"
      :placeholder="$t('media-picker-search')"
      inputmode="search"
      @update:model-value="onSearch"
    />
    <Skeleton v-if="library.loading.value" shape="block" />
    <FailureState
      v-else-if="library.error.value"
      :title="$t('media-picker-failed-title')"
      :description="$t(library.error.value)"
      :retry-label="$t('media-picker-retry')"
      @retry="onRetry"
    />
    <EmptyState
      v-else-if="empty"
      :title="$t('media-picker-empty-title')"
      :description="$t('media-picker-empty-body')"
    />
    <ul v-else :class="gridClasses">
      <li v-for="record in library.items.value" :key="record.id">
        <MediaLibraryTile :record="record" :src="srcOf(record)" @pick="onPick" />
      </li>
    </ul>
    <Pagination
      v-if="paged"
      :page="library.page.value"
      :per-page="library.pageSize.value"
      :total="library.total.value"
      @update:page="onPage"
    />
  </div>
</template>
