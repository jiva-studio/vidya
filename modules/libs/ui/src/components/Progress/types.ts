export interface ProgressProps {
  /** Percent complete, clamped to 0..100 by the component. */
  value: number
  label: string
  class?: string
}
