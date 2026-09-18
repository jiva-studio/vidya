/**
 * Merge tests — ….
 *
 * Nothing here is copied: Lectorium merges last-write-wins by HLC, while our
 * rule is field ownership. What these cases protect is the one sentence the
 * plan builds on — the client and the server never write the same field, so a
 * pulled review status must not land on an answer that has not been sent yet.
 */

import { hlcToString } from '../hlc'
import { mergeIncoming } from '../merge'
import { SyncDoc, SyncPayload } from '../types'

const stamp = (counter: number, deviceId = 'device-a'): string =>
  hlcToString({ physical: 1_700_000_000_000, counter, deviceId })

const doc = (data: SyncPayload | null, counter: number, deviceId?: string): SyncDoc => ({
  docId: 'doc-1',
  hlc: stamp(counter, deviceId),
  deleted: data === null,
  data,
})

describe('mergeIncoming, homework', () => {
  const local = doc({ text: 'my unsent answer', submittedAt: null, status: 'open', grade: null }, 5)
  const remote = doc(
    { text: 'stale server copy', submittedAt: null, status: 'in_review', grade: 4 },
    9,
    'server',
  )

  //
  it('takes a server-owned field from the incoming version, always', () => {
    const merged = mergeIncoming('homework', local, remote, true)

    expect(merged.data).toMatchObject({ status: 'in_review', grade: 4 })
  })

  //
  it('keeps a client-owned field while an unsent outbox row exists', () => {
    const merged = mergeIncoming('homework', local, remote, true)

    expect(merged.data).toMatchObject({ text: 'my unsent answer' })
  })

  //
  it('takes a client-owned field from the server once nothing is pending', () => {
    const merged = mergeIncoming('homework', local, remote, false)

    expect(merged).toEqual(remote)
  })

  it('drops a client-owned field the local version does not carry', () => {
    const withoutText = doc({ submittedAt: null, status: 'open', grade: null }, 5)

    const merged = mergeIncoming('homework', withoutText, remote, true)

    expect(merged.data).not.toHaveProperty('text')
  })

  it('keeps the higher stamp on the merged version', () => {
    const merged = mergeIncoming('homework', local, remote, true)

    expect(merged.hlc).toBe(remote.hlc)
  })

  it('lets a server tombstone through even with an unsent row', () => {
    const tombstone = doc(null, 11, 'server')

    expect(mergeIncoming('homework', local, tombstone, true)).toEqual(tombstone)
  })
})

describe('mergeIncoming, enrollments', () => {
  const local = doc({ status: 'pending', groupId: null }, 3)
  const remote = doc({ status: 'accepted', groupId: 'group-1', decidedById: 'user-2' }, 7, 'server')

  //: `status` is claimed by both sides, and the school's answer
  // supersedes the request that asked for it.
  it('gives a field claimed by both sides to the server', () => {
    const merged = mergeIncoming('enrollments', local, remote, true)

    expect(merged.data).toMatchObject({ status: 'accepted', groupId: 'group-1' })
  })
})

describe('mergeIncoming, one-way collections', () => {
  const local = doc({ title: 'local' }, 2)
  const remote = doc({ title: 'server' }, 4, 'server')

  it('takes the server version whole for a download-only collection', () => {
    expect(mergeIncoming('courses', local, remote, true)).toEqual(remote)
    expect(mergeIncoming('lessons', local, remote, true)).toEqual(remote)
    expect(mergeIncoming('lesson_versions', local, remote, true)).toEqual(remote)
  })

  it('keeps the local version of an upload-only collection while it is unsent', () => {
    expect(mergeIncoming('block_states', local, remote, true)).toEqual(local)
    expect(mergeIncoming('block_states', local, remote, false)).toEqual(remote)
  })

  it('takes the incoming version when the document is new here', () => {
    expect(mergeIncoming('homework', null, remote, true)).toEqual(remote)
  })

  it('is idempotent: merging a version with itself changes nothing', () => {
    expect(mergeIncoming('homework', remote, remote, true)).toEqual(remote)
  })
})

describe('mergeIncoming, unknown collection', () => {
  //: dropping the row in silence is how one lane ships a table the
  // other never hears about.
  it('throws rather than quietly passing the row through', () => {
    const remote = doc({ any: 'thing' }, 1)

    expect(() => mergeIncoming('chat_messages' as never, null, remote, false)).toThrow(
      /Unknown sync collection/,
    )
  })
})
