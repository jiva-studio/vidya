<script setup lang="ts">
import type { GroupId, MinuteOfDay } from '@vidya/domain'
import { isRecruiting } from '@vidya/domain'
import type { GroupSummary } from '@vidya/protocol'
import type { SelectOption } from '@vidya/ui'
import { Button, Dialog, DialogFooter, FormField, Select } from '@vidya/ui'
import { useFluent } from 'fluent-vue'
import { computed, ref, watch } from 'vue'

import { getGroups } from '@/entities/group'
import { useHttp } from '@/shared/api'

import type { EnrollmentReviewDialogEmits, EnrollmentReviewDialogProps } from '../types'
import { bodyClasses, errorClasses, fieldClasses, labelClasses, noteClasses } from './styles'
import { weekdayLabels } from './weekdayLabels'

const MINUTES_IN_DAY = 1440

/* --------------------------------- Props ---------------------------------- */

const props = withDefaults(defineProps<EnrollmentReviewDialogProps>(), {
  open: false,
  enrollment: undefined,
  busy: false,
  error: undefined,
})

/* --------------------------------- Events --------------------------------- */

const emit = defineEmits<EnrollmentReviewDialogEmits>()

/* --------------------------------- State ---------------------------------- */

const http = useHttp()
const { $t } = useFluent()

const groups = ref<GroupSummary[]>([])
const chosen = ref<string>('')
const unreadable = ref(false)

const options = computed<SelectOption[]>(() =>
  groups.value.map((group) => ({ value: group.id, label: group.name })),
)

// Which group was asked for is answered by the group's own row, not by the
// request: a request names a group that may since have been closed or deleted.
const asked = computed(() =>
  groups.value.find((group) => group.id === props.enrollment?.preferredGroupId),
)

const askedFor = computed(() => Boolean(props.enrollment?.preferredGroupId))

const askedName = computed(() => asked.value?.name ?? $t('enrollments-review-group-gone'))

const askedIsClosed = computed(() => !asked.value || !isRecruiting(asked.value.status))

const timeZone = computed(() => props.enrollment?.preferredTimes?.timeZone)

// The minutes arrive already in the student's own zone, so they are printed as
// they were sent and the zone is named beside them.
const ranges = computed(() =>
  (props.enrollment?.preferredTimes?.ranges ?? []).map((range) => ({
    days: range.days.map((day) => $t(weekdayLabels[day])).join(', '),
    hours: `${atMinute(range.startMinute)} – ${atMinute(range.endMinute)}`,
  })),
)

const noGroups = computed(() => !unreadable.value && groups.value.length === 0)

// A decision taken over a list that failed to arrive would read as "the course
// has no groups" and put the student in the queue for no reason.
const canAccept = computed(() => props.enrollment?.status === 'pending' && !unreadable.value)

/* ---------------------------------- Hooks --------------------------------- */

watch(
  () => [props.open, props.enrollment?.id],
  () => {
    if (props.open) void load()
  },
  { immediate: true },
)

/* -------------------------------- Handlers -------------------------------- */

function onOpenChange(open: boolean) {
  emit('update:open', open)
}

function onAccept() {
  emit('accept', chosen.value ? (chosen.value as GroupId) : undefined)
}

/* -------------------------------- Helpers --------------------------------- */

// An interval may run past midnight, and 1440 is the far side of this day
// rather than the start of the next; the device reads those hours the same way.
function atMinute(minute: MinuteOfDay): string {
  const hour = minute === MINUTES_IN_DAY ? 24 : Math.floor(minute / 60) % 24
  return `${String(hour).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

async function load() {
  chosen.value = props.enrollment?.preferredGroupId ?? ''
  groups.value = []
  unreadable.value = false

  const courseId = props.enrollment?.courseId
  if (!courseId) return

  try {
    // The groups of that course only: a student is placed in a group of the
    // course they applied to, and the whole school's list would offer the rest.
    const response = await getGroups(http, { courseId })
    groups.value = response.items
  } catch {
    unreadable.value = true
  }
}
</script>

<template>
  <Dialog
    :open="props.open"
    :title="$t('enrollments-review-title')"
    :close-label="$t('action-close')"
    @update:open="onOpenChange"
  >
    <div :class="bodyClasses">
      <div v-if="askedFor" :class="fieldClasses">
        <span :class="labelClasses">{{ $t('enrollments-review-group') }}</span>
        <span>{{ askedName }}</span>
        <span v-if="askedIsClosed" :class="noteClasses">
          {{ $t('enrollments-review-group-closed') }}
        </span>
      </div>
      <div v-if="ranges.length" :class="fieldClasses">
        <span :class="labelClasses">{{ $t('enrollments-review-times') }}</span>
        <span v-for="(range, index) in ranges" :key="index">
          {{ range.days }} {{ range.hours }}
        </span>
        <span :class="labelClasses">{{ $t('enrollments-review-zone', { zone: timeZone }) }}</span>
      </div>
      <div v-if="props.enrollment?.comment" :class="fieldClasses">
        <span :class="labelClasses">{{ $t('enrollments-review-comment') }}</span>
        <span>{{ props.enrollment.comment }}</span>
      </div>
      <FormField v-slot="field" :label="$t('enrollments-review-decision')">
        <Select
          :id="field.id"
          v-model="chosen"
          :options="options"
          :described-by="field.describedBy"
          :placeholder="$t('enrollments-group-queue')"
        />
      </FormField>
      <p v-if="unreadable" :class="errorClasses" role="alert">
        {{ $t('enrollments-review-groups-unreadable') }}
      </p>
      <p v-else-if="noGroups" :class="noteClasses">{{ $t('enrollments-review-groups-none') }}</p>
      <p v-if="props.error" :class="errorClasses" role="alert">{{ $t(props.error) }}</p>
    </div>
    <template #footer>
      <DialogFooter>
        <Button variant="secondary" @click="onOpenChange(false)">{{ $t('action-cancel') }}</Button>
        <Button v-if="canAccept" :busy="props.busy" @click="onAccept">
          {{ $t('enrollments-review-accept') }}
        </Button>
      </DialogFooter>
    </template>
  </Dialog>
</template>
