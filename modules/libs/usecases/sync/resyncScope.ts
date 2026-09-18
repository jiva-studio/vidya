import type { SyncScopeRef } from '@vidya/domain'

import type { SyncEngineDeps } from './ports'
import { pullAndMerge, type PullAndMergeOptions, type PullAndMergeResult } from './pullAndMerge'

/**
 * Fetching one scope again, from the beginning.
 *
 * This is the whole answer to a checksum that does not match (I-5, AC-10m). The
 * scope's position goes back to `0` and an ordinary pull brings its history
 * down again; every other scope keeps its position and is not re-fetched.
 *
 * "One scope, not the database" is the point of the whole design, not a
 * refinement of it. With a single global cursor — Lectorium's shape — the only
 * repair available for a suspected gap is to re-read the entire journal, which
 * on a student's phone over a mobile connection is the difference between a
 * hiccup and an evening. Per-scope positions make the repair proportional to
 * the damage.
 *
 * Applying is idempotent, so re-fetching costs bandwidth and nothing else:
 * `applyRemote` refuses anything not newer than the pointer already on record,
 * and the rows that do come back land exactly where they already were (D-4).
 * Local unsent work is untouched — the reset moves a read position, and the
 * outbox is not a read position.
 */
export async function resyncScope(
  deps: SyncEngineDeps,
  scope: SyncScopeRef,
  options: PullAndMergeOptions = {},
): Promise<PullAndMergeResult> {
  await deps.unitOfWork(() => deps.state.resetScope(scope))

  return pullAndMerge(deps, options)
}
