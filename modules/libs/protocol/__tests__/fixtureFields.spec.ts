import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { SYNC_WIRE_FIELDS } from '../syncFields'

/**
 * The fixtures are the contract both sides of the wire are tested against, and
 * nothing else checks that their field names are the protocol's field names.
 *
 * Both sides ignore keys they do not know, so a fixture calling a course's name
 * `title` passes on the server, passes on the device, and describes a message
 * neither of them would ever send. That is exactly what happened: `title` sat
 * in three fixtures while the protocol and the table both said `name`.
 *
 * The allowed names are `SYNC_WIRE_FIELDS` — the same list holds the two
 * projection tables to. A fixture, a server projection and a device projection
 * that each agreed with the protocol separately could still disagree with each
 * other; one list they are all measured against cannot let that happen.
 */
const ALLOWED: Partial<Record<string, readonly string[]>> = SYNC_WIRE_FIELDS

type Change = { collection?: string; data?: unknown }

const changesIn = (node: unknown, out: Change[] = []): Change[] => {
  if (Array.isArray(node)) {
    node.forEach((item) => changesIn(item, out))
    return out
  }
  if (node === null || typeof node !== 'object') return out

  const record = node as Record<string, unknown>
  if (typeof record.collection === 'string') out.push(record as Change)
  Object.values(record).forEach((value) => changesIn(value, out))

  return out
}

const directory = join(__dirname, '..', '__fixtures__', 'sync')

describe('wire fixtures', () => {
  const files = readdirSync(directory).filter((name) => name.endsWith('.json'))

  it('has fixtures to check', () => {
    expect(files.length).toBeGreaterThan(0)
  })

  it.each(files)('%s names fields the way the protocol does', (file) => {
    const parsed: unknown = JSON.parse(readFileSync(join(directory, file), 'utf8'))

    changesIn(parsed).forEach((change) => {
      const allowed = ALLOWED[change.collection ?? '']
      if (!allowed || change.data === null || typeof change.data !== 'object') return

      const unknownKeys = Object.keys(change.data as Record<string, unknown>).filter(
        (key) => !allowed.includes(key),
      )

      expect({ file, collection: change.collection, unknownKeys }).toEqual({
        file,
        collection: change.collection,
        unknownKeys: [],
      })
    })
  })
})

/**
 * Fixtures move with types (`process.md` §3).
 *
 * The suite above only forbids a name the protocol does not know, and a fixture
 * corpus that has never heard of a collection breaks no rule there: `ALLOWED`
 * has no entry for it, the change is skipped, and the contract grows while the
 * worked examples both sides read stay behind. The same holds for a field added
 * to a collection the fixtures already show — nothing is unknown, so nothing
 * fails, and neither side is ever driven through the new field.
 *
 * So the check runs the other way as well: a collection the fixtures name has
 * to be one the contract declares, and the fields this contract added have to
 * appear both in the contract and in some fixture carrying that collection.
 */

/** The wire names each collection is shown with, gathered across every file. */
const fieldsInFixtures = (): Map<string, Set<string>> => {
  const seen = new Map<string, Set<string>>()

  for (const file of readdirSync(directory).filter((name) => name.endsWith('.json'))) {
    const parsed: unknown = JSON.parse(readFileSync(join(directory, file), 'utf8'))

    for (const change of changesIn(parsed)) {
      const collection = change.collection ?? ''
      const names = seen.get(collection) ?? new Set<string>()
      seen.set(collection, names)

      if (change.data === null || typeof change.data !== 'object') continue
      Object.keys(change.data as Record<string, unknown>).forEach((key) => names.add(key))
    }
  }

  return seen
}

/**
 * What band 0b puts on the wire, named here rather than derived.
 *
 * Deriving it from `SYNC_WIRE_FIELDS` would make the check circular: the point
 * is that the contract and the fixtures moved together, and a list taken from
 * one of them cannot say whether the other followed.
 */
const ADDED_TO_THE_WIRE: ReadonlyArray<readonly [string, readonly string[]]> = [
  ['groups', ['id', 'courseId', 'name', 'description', 'startsAt', 'status']],
  ['enrollments', ['preferredGroupId', 'preferredTimes', 'comment', 'archivedByStudentAt']],
]

describe('the fixtures move with the contract', () => {
  it('names only collections the contract declares', () => {
    const declared = new Set(Object.keys(SYNC_WIRE_FIELDS))
    const undeclared = [...fieldsInFixtures().keys()].filter(
      (collection) => collection !== '' && !declared.has(collection),
    )

    expect(undeclared).toEqual([])
  })

  it.each(ADDED_TO_THE_WIRE.map(([collection, fields]) => [collection, fields] as const))(
    '%s: the contract and the fixtures both carry the new fields',
    (collection, fields) => {
      const declared = (SYNC_WIRE_FIELDS as Record<string, readonly string[] | undefined>)[
        collection
      ]
      const shown = fieldsInFixtures().get(collection)

      expect({
        collection,
        missingFromContract: fields.filter((field) => !(declared ?? []).includes(field)),
        missingFromFixtures: fields.filter((field) => !(shown ?? new Set()).has(field)),
      }).toEqual({ collection, missingFromContract: [], missingFromFixtures: [] })
    },
  )
})
