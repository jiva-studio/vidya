import { createGlobalState } from '@vueuse/core'
import { computed, ref } from 'vue'

import type { DeviceWrites, EnrollmentWrites } from './types'

/**
 * What the tab that writes offers the screens, and the rest of them do not.
 *
 * The engine is started behind the writing lock, and its repositories are the
 * only ones that append the outbox row that carries a write to the school. A
 * screen therefore asks for the writes rather than building a repository of
 * its own: in a reading tab there are none, and the screen says so instead of
 * saving something nothing would ever send.
 */
export const useDeviceWrites = createGlobalState((): DeviceWrites => {
  const enrollments = ref<EnrollmentWrites | undefined>(undefined)

  return {
    enrollments: computed(() => enrollments.value),
    adoptEnrollments: (writes) => {
      enrollments.value = writes
    },
  }
})
