<script setup lang="ts">
import type { GroupId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { Breadcrumbs, Button, PageHeader } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import { useGroupMembers } from '@/entities/group'

import GroupMembers from './GroupMembers.vue'
import { pageClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const route = useRoute()
const router = useRouter()

const groupId = asId<GroupId>(String(route.params.groupId ?? ''))
const roster = useGroupMembers(groupId)

const breadcrumbs = computed(() => [
  { key: 'groups', label: $t('groups-title') },
  { key: 'members', label: $t('group-members-title') },
])

/* -------------------------------- Handlers -------------------------------- */

function onBreadcrumb(key: string) {
  if (key === 'groups') void router.push({ name: 'groups' })
}

function onBack() {
  void router.push({ name: 'groups' })
}

function onRetry() {
  void roster.reload()
}
</script>

<template>
  <section :class="pageClasses">
    <PageHeader :title="$t('group-members-title')">
      <template #breadcrumbs>
        <Breadcrumbs :items="breadcrumbs" @select="onBreadcrumb" />
      </template>
      <template #actions>
        <Button variant="ghost" @click="onBack">{{ $t('group-members-back') }}</Button>
      </template>
    </PageHeader>
    <GroupMembers
      :rows="roster.members.value"
      :loading="roster.loading.value"
      :error="roster.error.value ? $t('state-error') : undefined"
      @retry="onRetry"
    />
  </section>
</template>
