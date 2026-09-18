/** How much play has to pass before progress is reported again, in seconds. */
const REPORT_EVERY_SECONDS = 5

/**
 * Throttles progress reporting to something a server can live with.
 *
 * `timeupdate` fires about four times a second, and every report is a request:
 * a ten-minute video would send a couple of thousand. Reporting every few
 * seconds of play is as accurate as a progress bar needs, and `settled` is
 * called on pause and on end so the position the student actually stopped at is
 * never the one that gets dropped.
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
