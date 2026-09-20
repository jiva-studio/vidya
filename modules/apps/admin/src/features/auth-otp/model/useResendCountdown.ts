import { computed, onScopeDispose, ref } from 'vue'

import type { Clock, Scheduled } from '@/shared/lib'
import { systemClock } from '@/shared/lib'

/**
 * How long until another code may be asked for.
 *
 * The server refuses a second code while the first is still alive, which is up
 * to five minutes, and answers 429 with no hint of how much of that is left.
 * A button that is merely enabled would therefore spend most of those minutes
 * producing an error, so the screen counts the wait down instead.
 */
export const CODE_LIFETIME_SECONDS = 300

export const useResendCountdown = (clock: Clock = systemClock) => {
  const remaining = ref(0)
  let scheduled: Scheduled | undefined

  const stop = () => {
    scheduled?.cancel()
    scheduled = undefined
  }

  // One second at a time rather than an interval: the port schedules a single
  // piece of work, and a countdown that re-arms itself stops on the tick that
  // reaches zero instead of on the one after it.
  const tick = () => {
    remaining.value -= 1
    if (remaining.value > 0) scheduled = clock.schedule(tick, 1000)
    else stop()
  }

  const start = (seconds: number = CODE_LIFETIME_SECONDS) => {
    stop()
    remaining.value = seconds
    if (seconds > 0) scheduled = clock.schedule(tick, 1000)
  }

  const canResend = computed(() => remaining.value <= 0)

  const label = computed(() => {
    const minutes = Math.floor(remaining.value / 60)
    const seconds = remaining.value % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}`
  })

  onScopeDispose(stop)

  return { remaining, canResend, label, start, stop }
}
