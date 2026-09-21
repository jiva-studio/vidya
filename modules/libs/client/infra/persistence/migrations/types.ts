import type { IsoDateTime } from '@vidya/domain'

import type { IDatabase } from '../../../ports'

/**
 * One forward-only change to the device schema.
 *
 * `name` is the stable identifier recorded in the `migrations` table and must
 * never change once released: it is the only thing that tells an already
 * migrated device to skip this step. `up` applies the change. There is no
 * `down` — a device cannot roll an image back, so a mistake is corrected by a
 * further migration, never by undoing one.
 */
export interface Migration {
  name: string
  up: (db: IDatabase) => Promise<void>
}

/**
 * Reads the current instant as an ISO 8601 UTC string.
 *
 * Injected rather than taken from the ambient clock so a test can pin it, and
 * typed as {@link IsoDateTime} so it cannot be a local time: everything stored
 * on the device is an instant in UTC, or time zones show up later in row
 * ordering and in displayed deadlines.
 */
export type UtcClock = () => IsoDateTime
