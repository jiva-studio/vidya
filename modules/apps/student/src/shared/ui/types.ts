export interface BackfillProgressProps {
  /** Records that have reached this machine so far. */
  rows: number

  /** Whether a run is going on at this moment. */
  running?: boolean
}
