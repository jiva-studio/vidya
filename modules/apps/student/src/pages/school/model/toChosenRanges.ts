import { education } from '@vidya/client'
import type { TimeRange } from '@vidya/domain'

/**
 * The stretches behind the presets a student ticked.
 *
 * Driven by the preset list rather than by the choice, so the request carries
 * the hours in the order they were offered: the row travels as `jsonb` and a
 * repeat of the same push is recognised by comparing bodies, which would read
 * the same wish written in another order as a change.
 */
export const toChosenRanges = (chosen: readonly string[]): TimeRange[] =>
  education.TIME_RANGE_PRESETS.filter((preset) => chosen.includes(preset.key)).map(
    (preset) => preset.range,
  )
