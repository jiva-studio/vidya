<script setup lang="ts">
import type { EnrollmentId, GroupId } from '@vidya/domain'
import type { TableColumn, TableRowData } from '@vidya/ui'
import { PageHeader, Table, Toaster } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted, ref } from 'vue'

import type { EnrollmentFilters, EnrollmentRow } from '@/entities/enrollment'
import { useEnrollments, useStudentNames } from '@/entities/enrollment'
import { useUserApi } from '@/entities/user'
import { useArchiveEnrollment } from '@/features/archive-enrollment'
import { GroupAssignDialog, useGroupAssignment } from '@/features/assign-group'
import { useModerateEnrollment } from '@/features/moderate-enrollment'
import { EnrollmentReviewDialog } from '@/features/review-enrollment'
import { useDirectory } from '@/features/school-directory'
import { useCan } from '@/shared/access'

import EnrollmentsFilters from './EnrollmentsFilters.vue'
import EnrollmentsTableRow from './EnrollmentsTableRow.vue'
import { sectionClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const users = useUserApi()
const students = useStudentNames(async (id) => (await users.get(id)).name)
const directory = useDirectory()
const enrollments = useEnrollments(students, directory)
const moderation = useModerateEnrollment()
const assignment = useGroupAssignment()
const archiving = useArchiveEnrollment()

const canModerate = useCan('enrollments:moderate')
const placing = ref<EnrollmentRow | undefined>(undefined)
const reviewing = ref<EnrollmentRow | undefined>(undefined)

const columns = computed<TableColumn[]>(() => [
  { key: 'student', label: $t('enrollments-column-student') },
  { key: 'course', label: $t('enrollments-column-course') },
  { key: 'group', label: $t('enrollments-column-group') },
  { key: 'status', label: $t('enrollments-column-status') },
  { key: 'actions', label: $t('enrollments-column-actions'), align: 'end' },
])

/* ---------------------------------- Hooks --------------------------------- */

onMounted(() => {
  void enrollments.load()
})

/* -------------------------------- Handlers -------------------------------- */

function onFilters(filters: EnrollmentFilters) {
  enrollments.filters.value = filters
  void enrollments.load()
}

function onRetry() {
  void enrollments.load()
}

// Accepting from the row honours what the student asked for: a decision that
// dropped the wish would put them on the course in no group at all, and the
// school would never know a group had been named. A group that has since gone
// is not passed on — the review dialog is where a new one is chosen.
async function onAccept(id: EnrollmentId) {
  const row = enrollments.rows.value.find((candidate) => candidate.id === id)
  if (await moderation.accept(id, stillThere(row?.preferredGroupId))) await enrollments.load()
}

async function onRevoke(id: EnrollmentId) {
  if (await moderation.revoke(id)) await enrollments.load()
}

async function onDecline(id: EnrollmentId) {
  if (await moderation.decline(id)) await enrollments.load()
}

function onAssignAsked(id: EnrollmentId) {
  placing.value = enrollments.rows.value.find((row) => row.id === id)
}

function onDialog(open: boolean) {
  if (!open) placing.value = undefined
}

async function onAssign(groupId: GroupId | null) {
  const enrollment = placing.value
  if (!enrollment) return

  const previous = enrollment.groupId ?? null
  placing.value = undefined
  if (await assignment.submit(enrollment.id, groupId, previous)) await enrollments.load()
}

function onReviewAsked(id: EnrollmentId) {
  moderation.forget()
  reviewing.value = enrollments.rows.value.find((row) => row.id === id)
}

function onReviewDialog(open: boolean) {
  if (!open) reviewing.value = undefined
}

async function onReviewAccepted(groupId: GroupId | undefined) {
  const enrollment = reviewing.value
  if (!enrollment) return

  // The dialog is what carries the request: it stays open until the server has
  // answered, so a refusal lands where the decision was made.
  if (!(await moderation.accept(enrollment.id, groupId))) return

  reviewing.value = undefined
  await enrollments.load()
}

async function onArchive(id: EnrollmentId) {
  if (await archiving.archive(id)) await enrollments.load()
}

async function onUndo(id: string) {
  if (await assignment.undo(id)) await enrollments.load()
}

/* -------------------------------- Helpers --------------------------------- */

function stillThere(groupId: GroupId | undefined): GroupId | undefined {
  if (!groupId) return undefined
  return directory.groupNames.value.has(groupId) ? groupId : undefined
}

function asEnrollment(row: TableRowData): EnrollmentRow {
  return row as EnrollmentRow
}

function isBusy(row: TableRowData): boolean {
  return moderation.deciding.value === asEnrollment(row).id
}

function isArchiving(row: TableRowData): boolean {
  return archiving.archiving.value === asEnrollment(row).id
}

function refusalFor(row: TableRowData): string | undefined {
  const refusal = archiving.error.value
  return refusal?.id === asEnrollment(row).id ? refusal.reason : undefined
}
</script>

<template>
  <section :class="sectionClasses">
    <PageHeader :title="$t('enrollments-title')" :description="$t('enrollments-description')" />
    <EnrollmentsFilters
      :filters="enrollments.filters.value"
      :course-options="directory.courseOptions.value"
      :group-options="directory.groupOptions.value"
      @update:filters="onFilters"
    />
    <Table
      :columns="columns"
      :rows="enrollments.rows.value"
      :loading="enrollments.loading.value"
      :error="enrollments.error.value ? $t('state-error') : undefined"
      :empty-title="$t('enrollments-empty-title')"
      :empty-description="$t('enrollments-empty-body')"
      :retry-label="$t('action-retry')"
      @retry="onRetry"
    >
      <template #row="{ row }">
        <EnrollmentsTableRow
          :enrollment="asEnrollment(row)"
          :can-moderate="canModerate"
          :busy="isBusy(row)"
          :archiving="isArchiving(row)"
          :archive-error="refusalFor(row)"
          @accept="onAccept"
          @decline="onDecline"
          @revoke="onRevoke"
          @assign-group="onAssignAsked"
          @review="onReviewAsked"
          @archive="onArchive"
        />
      </template>
    </Table>
    <EnrollmentReviewDialog
      :open="!!reviewing"
      :enrollment="reviewing"
      :busy="moderation.deciding.value === reviewing?.id"
      :error="moderation.error.value"
      @update:open="onReviewDialog"
      @accept="onReviewAccepted"
    />
    <GroupAssignDialog
      :open="!!placing"
      :course-id="placing?.courseId"
      :group-id="placing?.groupId"
      :busy="assignment.busy.value"
      :error="assignment.error.value"
      @update:open="onDialog"
      @submit="onAssign"
    />
    <Toaster :toasts="assignment.toasts.value" @dismiss="assignment.dismiss" @action="onUndo" />
  </section>
</template>
