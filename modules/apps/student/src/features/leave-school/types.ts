import type { LocalSchool } from '@vidya/client'

/**
 * How far leaving has got.
 *
 * An owner refused and a server that could not be reached are different
 * situations with different things to do next, so each has a stage of its own:
 * an owner has to hand the school over first, and everyone else can try again.
 */
export type LeaveStage = 'idle' | 'leaving' | 'left' | 'owner' | 'failed'

export interface LeaveSchoolPanelProps {
  school: LocalSchool

  /** Live places in this school, which leaving revokes; named before the call. */
  places: number
}
