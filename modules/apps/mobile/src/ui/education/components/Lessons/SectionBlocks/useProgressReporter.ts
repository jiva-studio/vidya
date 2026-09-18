/**
 * How much play has to pass before progress is reported again, in seconds.
 *
 * Five minutes, because this interval is only a safety net. The position is
 * recorded exactly on pause and on end, which covers every ordinary way a
 * student stops watching; the timer exists for the one case those miss — the
 * app being killed mid-playback — and losing up to five minutes of "continue
 * where you left off" there is not worth a request every few seconds.
 */
const REPORT_EVERY_SECONDS = 300

/**
 * Keeps progress reporting to what it is for.
 *
 * `timeupdate` fires about four times a second, and every report is a request,
 * so reporting on the raw event sends thousands of them for one lesson. What
 * the progress is actually used for is resuming playback on another device or
 * after a reinstall, and that needs a position, not a live feed.
 */
export function useProgressReporter(report: (element: HTMLMediaElement) => void) {
  let reportedAt = Number.NEGATIVE_INFINITY

  const settled = (element: HTMLMediaElement | undefined) => {
    if (!element) return
    reportedAt = element.currentTime
    report(element)
  }

  const tick = (element: HTMLMediaElement | undefined) => {
    if (!element) return
    if (Math.abs(element.currentTime - reportedAt) < REPORT_EVERY_SECONDS) return
    settled(element)
  }

  return { tick, settled }
}
