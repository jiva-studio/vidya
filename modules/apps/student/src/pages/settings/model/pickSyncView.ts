/** Which of the five things the settings screen has to say about the data. */
export type SyncView = 'signed-out' | 'running' | 'never' | 'empty' | 'idle'

export interface SyncViewInput {
  /** Whether there is an account to sync for at all. */
  readonly signedIn: boolean

  /** Whether a run is going on right now. */
  readonly syncing: boolean

  /** Whether a run has ever finished on this device. */
  readonly firstRunCompleted: boolean

  /** Whether anything has ever arrived on this device. */
  readonly received: boolean
}

/**
 * Tells the three quiet states apart.
 *
 * A device nothing has ever reached and a device the server has nothing to send
 * to both hold no rows, and only one of them is up to date: calling the first
 * one that promises a student their courses are here when they are not.
 */
export const pickSyncView = (input: SyncViewInput): SyncView => {
  if (!input.signedIn) return 'signed-out'
  if (input.syncing) return 'running'
  if (!input.firstRunCompleted) return 'never'

  return input.received ? 'idle' : 'empty'
}
