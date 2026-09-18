import { SyncCollections } from '@vidya/domain'
import { SYNC_MAX_CHANGE_BYTES, type SyncChange } from '@vidya/protocol'

import { NO_REQUIRED_FIELDS, utf8Length, validateChange } from '../validateChange'

/**
 * The guard on one incoming row — the unit half of T-X-1 … T-X-14.
 *
 * The device-level half of the same numbers lives in the mobile lane, where a
 * skipped row also has to advance a position and land in a report. Here the
 * question is narrower and worth asking on its own: given this row, does the
 * engine agree to store it, and if not, can it say why?
 */

const UUID = 'd7e93f41-5a0c-4b62-8e17-9c3d5f2a1b48'

const change = (fields: Partial<SyncChange> = {}): SyncChange =>
  ({
    serverSeq: 12,
    collection: 'homework',
    docId: UUID,
    op: 'upsert',
    data: { id: UUID, text: 'an answer' },
    hlc: '001789689601000:00000:server',
    scope: { kind: 'user', id: UUID },
    schoolId: UUID,
    createdAt: '2026-09-18T00:00:01.000Z',
    ...fields,
  }) as unknown as SyncChange

const reasonFor = (fields: Partial<SyncChange>, required = NO_REQUIRED_FIELDS): string => {
  const verdict = validateChange(change(fields), required)
  return verdict.verdict === 'skip' ? verdict.reason : 'storable'
}

describe('validating one incoming row', () => {
  it('accepts a well-formed row', () => {
    expect(reasonFor({})).toBe('storable')
  })

  it('accepts every collection that replicates', () => {
    for (const collection of SyncCollections) {
      expect(reasonFor({ collection, op: 'delete', data: null })).toBe('storable')
    }
  })

  it('T-X-1: refuses a collection this build does not know', () => {
    expect(reasonFor({ collection: 'grimoires' as never })).toBe('unknownCollection')
  })

  it('T-X-2: keeps a row carrying a field it has never heard of', () => {
    const verdict = validateChange(
      change({ data: { id: UUID, text: 'fine', astrologicalSign: 'libra' } }),
      NO_REQUIRED_FIELDS,
    )

    expect(verdict.verdict).toBe('storable')
    // The unknown field survives validation; the projection is what drops it.
    expect(verdict.verdict === 'storable' && verdict.change.data).toMatchObject({
      astrologicalSign: 'libra',
    })
  })

  it('T-X-3: refuses a row missing a field that addresses it', () => {
    const required = () => ['enrollmentId', 'sectionId']
    expect(reasonFor({ data: { id: UUID } }, required)).toBe('missingField')
    expect(reasonFor({ data: { id: UUID, enrollmentId: UUID, sectionId: UUID } }, required)).toBe(
      'storable',
    )
  })

  it('T-X-3: a null in a required field counts as missing', () => {
    expect(reasonFor({ data: { id: UUID, enrollmentId: null } }, () => ['enrollmentId'])).toBe(
      'missingField',
    )
  })

  it('T-X-4: refuses an upsert whose data is null', () => {
    expect(reasonFor({ op: 'upsert', data: null })).toBe('missingData')
  })

  it('a delete carries no data, and that is correct', () => {
    expect(reasonFor({ op: 'delete', data: null }, () => ['enrollmentId'])).toBe('storable')
  })

  it('T-X-5: refuses an HLC that does not parse', () => {
    expect(reasonFor({ hlc: 'yesterday' })).toBe('invalidHlc')
    expect(reasonFor({ hlc: '' })).toBe('invalidHlc')
    expect(reasonFor({ hlc: 12 as never })).toBe('invalidHlc')
  })

  it('T-X-6: refuses a docId that is not a uuid', () => {
    expect(reasonFor({ docId: 'the-one-i-wrote' })).toBe('invalidDocId')
    expect(reasonFor({ docId: '' })).toBe('invalidDocId')
  })

  it('refuses an operation that is neither upsert nor delete', () => {
    expect(reasonFor({ op: 'merge' as never })).toBe('invalidOp')
  })

  it('refuses a sequence that is not a positive integer', () => {
    expect(reasonFor({ serverSeq: 0 })).toBe('invalidSeq')
    expect(reasonFor({ serverSeq: -3 })).toBe('invalidSeq')
    expect(reasonFor({ serverSeq: 1.5 })).toBe('invalidSeq')
  })

  it('refuses a scope it cannot address', () => {
    expect(reasonFor({ scope: undefined as never })).toBe('invalidScope')
    expect(reasonFor({ scope: { kind: 'planet', id: UUID } as never })).toBe('invalidScope')
    expect(reasonFor({ scope: { kind: 'user', id: '' } as never })).toBe('invalidScope')
  })

  it('T-X-11: refuses a payload over the ceiling', () => {
    const huge = { id: UUID, text: 'x'.repeat(SYNC_MAX_CHANGE_BYTES + 1) }
    expect(reasonFor({ data: huge })).toBe('payloadTooLarge')
  })

  it('D-2: a body of exactly the ceiling is stored, school or no school', () => {
    // The size the server measured is the size of the body it sent. The school
    // it files the row under travels in the envelope, and a lesson version
    // carries none of its own — measure the row with ours folded in and the
    // boundary moves fifty bytes, so a row the server passed is skipped here
    // while its scope position walks straight past it. The content is then
    // gone for good: nothing fetches a row below the position again.
    const shell = JSON.stringify({ id: UUID, text: '' })
    const text = 'x'.repeat(SYNC_MAX_CHANGE_BYTES - shell.length)
    const body = { id: UUID, text }
    expect(utf8Length(JSON.stringify(body))).toBe(SYNC_MAX_CHANGE_BYTES)

    const verdict = validateChange(change({ data: body }), NO_REQUIRED_FIELDS)

    expect(verdict.verdict).toBe('storable')
    expect(verdict.verdict === 'storable' && verdict.change.data).toEqual({
      id: UUID,
      text,
      schoolId: UUID,
    })
  })

  it('T-X-13: the ceiling is counted in bytes, not characters', () => {
    // Every one of these is four bytes, so a quarter as many fit as a naive
    // length check would allow — and the server counts bytes too.
    const emoji = '🙏'.repeat(SYNC_MAX_CHANGE_BYTES / 4)
    expect(reasonFor({ data: { id: UUID, text: emoji } })).toBe('payloadTooLarge')
  })

  it('T-X-12: text of any script passes through untouched', () => {
    const text = 'श्री · 🙏🏽 · مرحبا · שלום'
    const verdict = validateChange(change({ data: { id: UUID, text } }), NO_REQUIRED_FIELDS)

    // The school is folded in from the envelope — one local database holds
    // several, and not every document repeats its own. Everything the server
    // actually wrote survives byte for byte, which is what this test is about.
    expect(verdict.verdict === 'storable' && verdict.change.data).toEqual({
      id: UUID,
      text,
      schoolId: UUID,
    })
  })

  it('T-X-14: an empty string and an empty array are values, not absences', () => {
    const verdict = validateChange(change({ data: { id: UUID, text: '', tags: [] } }), () => [
      'text',
    ])

    expect(verdict.verdict).toBe('storable')
  })
})

describe('counting utf-8 bytes', () => {
  it('counts each script at its real width', () => {
    expect(utf8Length('abc')).toBe(3)
    expect(utf8Length('ü')).toBe(2)
    expect(utf8Length('श')).toBe(3)
    expect(utf8Length('🙏')).toBe(4)
    expect(utf8Length('')).toBe(0)
  })

  it('agrees with the platform encoder', () => {
    const samples = ['', 'plain', 'ünïcøde', 'श्री राम', '🙏🏽 family 👨‍👩‍👧', 'مرحبا שלום']
    for (const sample of samples) {
      expect(utf8Length(sample)).toBe(Buffer.byteLength(sample, 'utf8'))
    }
  })
})
