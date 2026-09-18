<script setup lang="ts">
import { Button, PageHeader } from '@vidya/ui'
import { useRouter } from 'vue-router'

import { useGroups } from '@/entities/group'
import { useCan } from '@/shared/access'

import GroupsTable from './GroupsTable.vue'
import { pageClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const router = useRouter()
const groups = useGroups()

const canCreate = useCan('groups:create')
const canEdit = useCan('groups:update')

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
</script>

<template>
  <section :class="pageClasses">
    <PageHeader :title="$t('groups-title')">
      <template #actions>
        <Button v-if="canCreate" @click="onCreate">{{ $t('groups-create') }}</Button>
      </template>
    </PageHeader>
    <GroupsTable
      :rows="groups.items.value"
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
