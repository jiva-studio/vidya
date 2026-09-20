import type { TimeRange } from '@vidya/domain'

export interface TimeRangeItemProps {
  range: TimeRange
}

export interface TimeRangeItemEmits {
  click: []
  remove: []
}

export interface TimeRangeSelectorProps {
  modelValue: readonly TimeRange[]
}

export interface TimeRangeSelectorEmits {
  'update:modelValue': [ranges: readonly TimeRange[]]
}
