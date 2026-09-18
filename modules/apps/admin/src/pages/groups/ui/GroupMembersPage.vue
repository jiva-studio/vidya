<script setup lang="ts">
import type { GroupId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { Button, PageHeader } from '@vidya/ui'
import { useRoute, useRouter } from 'vue-router'

import { useGroupMembers } from '@/entities/group'

import GroupMembers from './GroupMembers.vue'
import { pageClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const route = useRoute()
const router = useRouter()

const groupId = asId<GroupId>(String(route.params.groupId ?? ''))
const roster = useGroupMembers(groupId)

/* -------------------------------- Handlers -------------------------------- */

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
      <template #actions>
        <Button variant="ghost" @click="onBack">{{ $t('group-members-back') }}</Button>
      </template>
    </PageHeader>
    <GroupMembers
      :rows="roster.members.value"
      :loading="roster.loading.value"
      :error="roster.error.value && $t(roster.error.value)"
      @retry="onRetry"
    />
  </section>
</template>
