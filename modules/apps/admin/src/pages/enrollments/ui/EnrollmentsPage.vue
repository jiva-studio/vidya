<script setup lang="ts">
import type { EnrollmentId, GroupId } from '@vidya/domain'
import type { TableColumn, TableRowData } from '@vidya/ui'
import { PageHeader, Table, Toaster } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, onMounted, ref } from 'vue'

import type { EnrollmentFilters, EnrollmentRow } from '@/entities/enrollment'
import { useEnrollments, useStudentNames } from '@/entities/enrollment'
import { useUserApi } from '@/entities/user'
import { GroupAssignDialog, useGroupAssignment } from '@/features/assign-group'
import { useModerateEnrollment } from '@/features/moderate-enrollment'
import { useDirectory } from '@/features/school-directory'
import { useCan } from '@/shared/access'

import EnrollmentsFilters from './EnrollmentsFilters.vue'
import EnrollmentsTableRow from './EnrollmentsTableRow.vue'
import { errorClasses, sectionClasses } from './styles'

/* --------------------------------- State ---------------------------------- */

const { $t } = useFluent()
const users = useUserApi()
const students = useStudentNames(async (id) => (await users.get(id)).name)
const directory = useDirectory()
const enrollments = useEnrollments(students, directory)
const moderation = useModerateEnrollment()
const assignment = useGroupAssignment()

const canModerate = useCan('enrollments:moderate')
const placing = ref<EnrollmentRow | undefined>(undefined)

const columns = computed<TableColumn[]>(() => [
  { key: 'student', label: $t('enrollments-column-student') },
  { key: 'course', label: $t('enrollments-column-course') },
  { key: 'group', label: $t('enrollments-column-group') },
  { key: 'status', label: $t('enrollments-column-status') },
  { key: 'actions', label: $t('enrollments-column-actions'), align: 'end' },
])

const errorText = computed(() =>
  enrollments.error.value ? $t(enrollments.error.value) : undefined,
)

const failure = computed(() => moderation.error.value && $t(moderation.error.value))

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

async function onAccept(id: EnrollmentId) {
  if (await moderation.accept(id)) await enrollments.load()
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

async function onUndo(id: string) {
  if (await assignment.undo(id)) await enrollments.load()
}

/* -------------------------------- Helpers --------------------------------- */

function asEnrollment(row: TableRowData): EnrollmentRow {
  return row as EnrollmentRow
}

function isBusy(row: TableRowData): boolean {
  return moderation.deciding.value === asEnrollment(row).id
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
    <p v-if="failure" :class="errorClasses" role="alert">{{ failure }}</p>
    <Table
      :columns="columns"
      :rows="enrollments.rows.value"
      :loading="enrollments.loading.value"
      :error="errorText"
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
          @accept="onAccept"
          @decline="onDecline"
          @assign-group="onAssignAsked"
        />
      </template>
    </Table>
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
