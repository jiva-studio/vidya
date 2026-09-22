/**
 * How far play has to move before the position is recorded again, in seconds.
 *
 * Five minutes, because the interval is a safety net and nothing else. The
 * position is recorded exactly on pause and on end, which covers every
 * ordinary way of stopping; this is for the one case those miss — the tab
 * going away mid-playback. `timeupdate` fires about four times a second, and
 * every record here is the whole database written out again, so recording on
 * the raw event would cost thousands of writes for one lesson.
 */
const REPORT_EVERY_SECONDS = 300

/** Whether play has moved far enough from the last recorded position to record again. */
export const hasMovedOn = (position: number, recordedAt: number): boolean =>
  Math.abs(position - recordedAt) >= REPORT_EVERY_SECONDS
