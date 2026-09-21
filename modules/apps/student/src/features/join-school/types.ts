/**
 * How far the joining page has got.
 *
 * Every refusal has a stage of its own, because a student reads them as
 * different situations: a link that leads nowhere, a school that is not taking
 * students, and a server that could not be reached are three different things
 * to do next.
 */
export type JoinStage =
  'resolving' | 'ready' | 'joining' | 'joined' | 'unknown' | 'closed' | 'failed'

/**
 * What a stage says to the student when there is nothing to do but read it.
 *
 * `title` and `text` are message keys. `retry` is whether trying the same
 * thing again is worth offering: a server that could not be reached is worth
 * another try, a school that takes no students is not.
 */
export interface JoinNotice {
  readonly title: string
  readonly text: string
  readonly retry: boolean
}

export interface JoinPanelProps {
  /** The school's public code, as the printed link spells it. */
  code: string
}

export interface JoinPanelEmits {
  /** There is no session yet; the page decides where signing in happens. */
  (event: 'sign-in'): void
}
