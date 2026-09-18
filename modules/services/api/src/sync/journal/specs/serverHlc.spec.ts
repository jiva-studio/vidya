import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import { appendJournalRow, Clock, ServerHlcService } from '@vidya/api/sync'
import { asId, parseHlc, SchoolId } from '@vidya/domain'
import { DataSource } from 'typeorm'
import { v4 as uuid } from 'uuid'

import { createJournalContext, JournalContext } from './context'

/**
 * Two API instances must not stamp one document with one HLC.
 *
 * The clock is frozen on purpose, and both services are handed the *same*
 * frozen clock: that is the shape of the accident — two pods answering two
 * requests in the same millisecond. If the stamps are equal the journal's
 * idempotency index reads the second write as a retry of the first and drops
 * it, which is why the second case writes rather than compares.
 */
const frozen = (nowMs: number): Clock => ({ nowMs: () => nowMs })

const NOW = 1_800_000_000_000

describe('the server HLC across instances', () => {
  let app: INestApplication
  let ds: DataSource
  let ctx: JournalContext

  beforeEach(async () => {
    app = await createTestingApp()
    ds = app.get(DataSource)
    ctx = await createJournalContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  it('gives two instances sharing one clock two different stamps', async () => {
    const clock = frozen(NOW)

    const first = await new ServerHlcService(clock).next(ds.manager)
    const second = await new ServerHlcService(clock).next(ds.manager)

    expect(first).not.toBe(second)

    // The difference is the device id, not the ordering: the comparable halves
    // stay the moment both instances were in.
    expect(parseHlc(first).physical).toBe(parseHlc(second).physical)
    expect(parseHlc(first).deviceId).not.toBe(parseHlc(second).deviceId)
    expect(first).toMatch(/^\d{15}:\d{5}:server:/)
  })

  it('keeps both edits of one document when two instances stamp it at once', async () => {
    const clock = frozen(NOW)
    const docId = uuid()

    const stamps = [
      await new ServerHlcService(clock).next(ds.manager),
      await new ServerHlcService(clock).next(ds.manager),
    ]

    for (const hlc of stamps) {
      await ds.transaction((manager) =>
        appendJournalRow(manager, {
          collection: 'homework',
          docId,
          op: 'upsert',
          data: { text: hlc },
          hlc,
          scopeKind: 'user',
          scopeId: ctx.student.id,
          schoolId: asId<SchoolId>(ctx.school.id),
          deviceId: null,
          authorId: null,
        }),
      )
    }

    const rows: { hlc: string }[] = await ds.query(
      'SELECT hlc FROM sync_journal WHERE doc_id = $1 ORDER BY global_seq',
      [docId],
    )

    expect(rows.map((row) => row.hlc)).toEqual(stamps)
  })
})
