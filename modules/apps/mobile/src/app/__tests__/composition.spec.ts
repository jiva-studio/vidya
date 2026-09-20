import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * A claim about the shipped build that no behavioural test can make.
 *
 * The whole local layer — SQLite, the repositories, the outbox, the clock —
 * was written, covered and never started: the only caller of `startSync` was a
 * test. Everything passed and the production build carried a dead half. So the
 * source itself is the subject here, and the assertion is that a caller exists
 * outside the tests.
 */

const SOURCE = join(import.meta.dirname, '../..')

function sourceFiles(directory: string): string[] {
  const entries = readdirSync(directory, { withFileTypes: true })

  return entries.flatMap((entry) => {
    const full = join(directory, entry.name)
    if (entry.isDirectory()) return entry.name === '__tests__' ? [] : sourceFiles(full)
    return /\.(ts|vue)$/.test(entry.name) ? [full] : []
  })
}

describe('the shipped composition', () => {
  it('starts the sync engine from the app and not only from a test', () => {
    const callers = sourceFiles(SOURCE).filter(
      (file) =>
        !file.endsWith(join('app', 'sync.ts')) && readFileSync(file, 'utf8').includes('startSync('),
    )

    expect(callers).not.toHaveLength(0)
  })
})
