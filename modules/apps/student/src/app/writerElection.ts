/** The lock that names the tab allowed to write the local database. */
export const WRITER_LOCK = 'vidya.student.writer'

export interface ElectWriterOptions {
  /** `navigator.locks`, or a stand-in in a test. */
  readonly locks: LockManager | undefined

  readonly name: string

  /**
   * Runs while this tab holds the lock, and is awaited before the role counts
   * as taken: whatever it does — migrating, starting the engine — happens with
   * every other tab shut out of writing.
   */
  onElected(): Promise<void> | void
}

export interface WriterElection {
  /**
   * `true` once this tab holds the lock and `onElected` has finished, `false`
   * as soon as it is known that another tab holds it.
   *
   * It settles promptly either way, so start-up never waits on a tab that may
   * stay open all day. A tab told `false` keeps waiting in the background and
   * takes the role over if the writer goes away.
   */
  readonly writes: Promise<boolean>

  /** Gives the role up, letting a waiting tab have it. */
  release(): void
}

/**
 * Elects the one tab that writes the local database.
 *
 * The database is a SQLite image in IndexedDB, written whole on every
 * committed write. Two tabs writing it are not two writers racing over one
 * row: each exports its own copy of the whole file, and the last export wins,
 * so an answer typed in one tab disappears when the other one saves. The Web
 * Locks API is the browser's own answer to "one of these tabs, whichever" —
 * the lock is held for as long as the callback's promise is unsettled, and the
 * browser hands it to the next tab in line the moment the holder is gone,
 * including when it is closed without warning.
 *
 * A browser without the API writes anyway. One tab is the ordinary case, and a
 * site that refuses to save because it cannot check would be broken for
 * everyone in order to protect the few who open a second tab.
 */
export const electWriter = (options: ElectWriterOptions): WriterElection => {
  const { locks, name, onElected } = options

  let release = (): void => {}
  const held = new Promise<void>((resolve) => {
    release = resolve
  })

  const hold = async (): Promise<void> => {
    await onElected()
    await held
  }

  if (locks === undefined) {
    return { writes: Promise.resolve(onElected()).then(() => true), release }
  }

  let decide: (writes: boolean) => void = () => {}
  const writes = new Promise<boolean>((resolve) => {
    decide = resolve
  })

  const requested = locks.request(name, { ifAvailable: true }, async (lock) => {
    if (lock === null) {
      decide(false)
      return
    }

    try {
      await onElected()
    } finally {
      // Settled whatever the work did, or a start-up that failed inside it
      // would hang on a promise nothing else resolves.
      decide(true)
    }

    await held
  })

  // A caller that does not watch `writes` — a tab taking the role over hours
  // later — would otherwise lose the reason inside an unhandled rejection.
  void requested.catch((error: unknown) => {
    console.error('the writing tab could not take the role', error)
  })

  void writes.then((writesHere) => {
    if (writesHere) return

    // Queued behind the tab that has it: when that tab closes, this one takes
    // over without the student reloading anything.
    void locks
      .request(name, () => hold())
      .catch((error: unknown) => {
        console.error('the writing tab could not take the role', error)
      })
  })

  return { writes, release }
}
