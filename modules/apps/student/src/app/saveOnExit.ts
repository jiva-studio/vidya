import type { IDatabase } from '@vidya/client'

/**
 * Writes the database out on the way out of the page.
 *
 * A tab has no `suspend()` and no lifecycle to hook: it is closed, or hidden,
 * or the browser discards it, and none of that waits for anything of ours.
 * Both events are wired deliberately — `pagehide` is the last one a tab is
 * promised, and `visibilitychange` is the one a mobile browser actually
 * delivers when the student switches app — and saving twice costs an export
 * that has nothing left to write.
 *
 * Nothing is awaited: the page is going away, and the export is already
 * running. What it buys is the writes that were made outside a transaction,
 * which the adapter exports on its own schedule.
 */
export const saveOnExit = (db: IDatabase, page: Document = document): (() => void) => {
  const save = () => {
    void db.save().catch((error: unknown) => {
      console.warn('the local database could not be written out on the way out', error)
    })
  }

  const onHidden = () => {
    if (page.visibilityState === 'hidden') save()
  }

  page.addEventListener('visibilitychange', onHidden)
  page.defaultView?.addEventListener('pagehide', save)

  return () => {
    page.removeEventListener('visibilitychange', onHidden)
    page.defaultView?.removeEventListener('pagehide', save)
  }
}
