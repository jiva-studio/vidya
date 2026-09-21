<script setup lang="ts">
import type { EnrollmentId, GroupId } from '@vidya/domain'
import { asId } from '@vidya/domain'
import { Breadcrumbs, Button, PageHeader, Toaster } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import type { GroupMember } from '@/entities/group'
import { useGroupMembers } from '@/entities/group'
import { GroupAssignDialog, useGroupAssignment } from '@/features/assign-group'
import { useModerateEnrollment } from '@/features/moderate-enrollment'
import { useCan } from '@/shared/access'

import GroupMembers from './GroupMembers.vue'
import { pageClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const route = useRoute()
const router = useRouter()

const groupId = asId<GroupId>(String(route.params.groupId ?? ''))
const roster = useGroupMembers(groupId)
const moderation = useModerateEnrollment()
const assignment = useGroupAssignment()

const canModerate = useCan('enrollments:moderate')
const moving = ref<GroupMember | undefined>(undefined)

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

async function onRevoke(enrollmentId: string) {
  if (await moderation.revoke(asId<EnrollmentId>(enrollmentId))) await roster.reload()
}

async function onRestore(enrollmentId: string) {
  // Back onto the course, and back into this group: the roster is the one
  // screen where the group the place belongs to is never in doubt.
  if (await moderation.accept(asId<EnrollmentId>(enrollmentId), groupId)) await roster.reload()
}

function onMove(enrollmentId: string) {
  moving.value = roster.members.value.find((member) => member.enrollmentId === enrollmentId)
}

function onMoveDialog(open: boolean) {
  if (!open) moving.value = undefined
}

async function onMoved(next: GroupId | null) {
  const member = moving.value
  if (!member) return

  moving.value = undefined
  if (await assignment.submit(asId<EnrollmentId>(member.enrollmentId), next, groupId)) {
    await roster.reload()
  }
}

async function onUndo(id: string) {
  if (await assignment.undo(id)) await roster.reload()
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
      :can-moderate="canModerate"
      :busy="moderation.deciding.value"
      @retry="onRetry"
      @revoke="onRevoke"
      @restore="onRestore"
      @move="onMove"
    />
    <GroupAssignDialog
      :open="!!moving"
      :course-id="moving?.courseId"
      :group-id="groupId"
      :busy="assignment.busy.value"
      :error="assignment.error.value"
      @update:open="onMoveDialog"
      @submit="onMoved"
    />
    <Toaster :toasts="assignment.toasts.value" @dismiss="assignment.dismiss" @action="onUndo" />
  </section>
</template>
