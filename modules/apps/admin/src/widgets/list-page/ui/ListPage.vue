<script setup lang="ts">
import { Button, PageHeader, Pagination } from '@vidya/ui'

import { PAGE_SIZE } from '@/shared/lib'
import { PageBack } from '@/shared/navigation'

import type { ListPageEmits, ListPageProps } from '../types'
import { pageClasses } from './styles'

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<ListPageProps>(), {
  description: undefined,
  createLabel: undefined,
  page: 1,
  perPage: PAGE_SIZE,
  total: 0,
  paged: false,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<ListPageEmits>()

/* -------------------------------- Handlers -------------------------------- */

function onCreate() {
  emit('create')
}

function onPage(page: number) {
  emit('update:page', page)
}
</script>

<template>
  <section :class="pageClasses">
    <PageHeader :title="props.title" :description="props.description">
      <template #leading><PageBack /></template>
      <template v-if="props.createLabel" #actions>
        <Button @click="onCreate">{{ props.createLabel }}</Button>
      </template>
    </PageHeader>
    <slot name="filters" />
    <slot />
    <Pagination
      v-if="props.paged"
      :page="props.page"
      :per-page="props.perPage"
      :total="props.total"
      @update:page="onPage"
    />
    <slot name="after" />
  </section>
</template>
