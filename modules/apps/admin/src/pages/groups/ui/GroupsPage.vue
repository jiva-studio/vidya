<script setup lang="ts">
import { Button, PageHeader, TableFilters } from '@vidya/ui'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'

import { useGroups } from '@/entities/group'
import { useCan } from '@/shared/access'

import GroupsTable from './GroupsTable.vue'
import { pageClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const router = useRouter()
const groups = useGroups()
const search = ref('')

const canCreate = useCan('groups:create')
const canEdit = useCan('groups:update')

const displayedItems = computed(() => {
  if (!search.value.trim()) return groups.items.value
  const query = search.value.trim().toLowerCase()
  return groups.items.value.filter((group) => group.name.toLowerCase().includes(query))
})

/* -------------------------------- Handlers -------------------------------- */

function onCreate() {
  void router.push({ name: 'group-create' })
}

function onEdit(id: string) {
  void router.push({ name: 'group-edit', params: { groupId: id } })
}

function onMembers(id: string) {
  void router.push({ name: 'group-members', params: { groupId: id } })
}

function onRetry() {
  void groups.reload()
}

function onClear() {
  search.value = ''
}
</script>

<template>
  <section :class="pageClasses">
    <PageHeader :title="$t('groups-title')">
      <template #actions>
        <Button v-if="canCreate" @click="onCreate">{{ $t('groups-create') }}</Button>
      </template>
    </PageHeader>
    <TableFilters
      v-if="groups.items.value.length >= 10 || search"
      v-model:search="search"
      :search-label="$t('groups-title')"
      :filters-applied="!!search"
      @clear="onClear"
    />
    <GroupsTable
      :rows="displayedItems"
      :loading="groups.loading.value"
      :error="groups.error.value && $t(groups.error.value)"
      :can-create="canCreate"
      :can-edit="canEdit"
      @retry="onRetry"
      @create="onCreate"
      @edit="onEdit"
      @members="onMembers"
    />
  </section>
</template>
