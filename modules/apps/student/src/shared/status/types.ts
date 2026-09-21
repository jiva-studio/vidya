import type { Ref } from 'vue'

/** What the browser promised about keeping the local database. */
export type StorageDurability = 'persistent' | 'temporary' | 'unknown'

/**
 * What the site can say about itself, as the settings screen reads it.
 *
 * Offline is not a promise here (there is no offline banner), but the state of
 * the data is not a secret either: a record that has been saved and not yet
 * sent is the student's work, and the screen that says so reads these.
 */
export interface SiteStatus {
  /** A sync run is going on right now. */
  readonly syncing: Readonly<Ref<boolean>>

  /** A run has completed at least once, so an empty screen means empty. */
  readonly firstRunCompleted: Readonly<Ref<boolean>>

  /** Anything at all has arrived on this device, on this day or an earlier one. */
  readonly received: Readonly<Ref<boolean>>

  /** Rows applied to the local database since this tab opened. */
  readonly done: Readonly<Ref<number>>

  /** Whether this tab is the one that writes; the others read. */
  readonly writing: Readonly<Ref<boolean>>

  /** A school was joined in this tab and nothing of it has arrived yet. */
  readonly joined: Readonly<Ref<boolean>>

  readonly storage: Readonly<Ref<StorageDurability>>

  runStarted(): void
  runFinished(applied: number, completed: boolean): void

  /**
   * Says the database is already filled, without a run having finished here.
   *
   * A tab opened on a database that already holds scope positions is a tab
   * opened after a first run that happened some other day: the courses are
   * there, and the screens must not cover them with "getting your courses
   * ready" — least of all with no network, when that promise cannot be kept.
   */
  markFilled(): void

  /**
   * Says a school was joined here a moment ago.
   *
   * It holds for the life of the tab. Between the join and the first page of
   * that school's data there is nothing on the machine to show, and the one
   * thing the screens must not conclude from that is that nobody ever invited
   * this student anywhere.
   */
  markJoined(): void

  markWriting(writing: boolean): void
  markStorage(durability: StorageDurability): void
}
