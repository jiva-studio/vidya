import { hlcToString } from '@vidya/domain'
import { DataSource } from 'typeorm'

import { bootstrap } from '../bootstrap'
import { attachSyncJournal } from '../datasource'
import { seedStudentStand } from '../studentStand'
import { testingDataSource } from './testing.datasource'

const EMAIL = 'student@example.com'
const OWNER = 'owner@example.com'

interface JournalRow {
  collection: string
  doc_id: string
  op: string
  hlc: string
  school_id: string
  device_id: string | null
}

describe('what the seeder writes reaching devices', () => {
  let dataSource: DataSource

  const journal = (): Promise<JournalRow[]> =>
    dataSource.query('SELECT collection, doc_id, op, hlc, school_id, device_id FROM sync_journal')

  const collections = async (): Promise<string[]> => [
    ...new Set((await journal()).map((row) => row.collection)),
  ]

  beforeEach(async () => {
    dataSource = attachSyncJournal(await testingDataSource())
  })

  afterEach(async () => {
    await dataSource.destroy()
  })

  describe('the student stand', () => {
    it('journals the school, the course, the lesson and the lesson version', async () => {
      await seedStudentStand(dataSource, { email: EMAIL })

      expect((await collections()).sort()).toEqual([
        'courses',
        'lesson_versions',
        'lessons',
        'schools',
      ])
    })

    it('journals each row under the document it created', async () => {
      const result = await seedStudentStand(dataSource, { email: EMAIL })

      const rows = await journal()
      const docIds = new Map(rows.map((row) => [row.collection, row.doc_id]))

      expect(docIds.get('schools')).toBe(result.schoolId)
      expect(docIds.get('courses')).toBe(result.courseId)
      expect(docIds.get('lessons')).toBe(result.lessonId)
      expect(docIds.get('lesson_versions')).toBe(result.lessonVersionId)
    })

    it('files every row under the school it belongs to', async () => {
      const result = await seedStudentStand(dataSource, { email: EMAIL })

      const rows = await journal()

      expect(new Set(rows.map((row) => row.doc_id)).size).toBe(4)
      expect(rows.every((row) => row.school_id === result.schoolId)).toBe(true)
    })

    it('marks the rows as written by no device, so every device is handed them', async () => {
      await seedStudentStand(dataSource, { email: EMAIL })

      const rows = await journal()

      expect(new Set(rows.map((row) => row.doc_id)).size).toBe(4)
      expect(rows.every((row) => row.device_id === null)).toBe(true)
    })

    it('stamps rows above everything the journal already holds', async () => {
      const held = hlcToString({ physical: Date.now() + 86_400_000, counter: 0, deviceId: 'other' })
      await dataSource.query(
        `INSERT INTO sync_journal
           (collection, doc_id, op, data, hlc, scope_kind, scope_id, school_id)
         VALUES ('schools', $1, 'upsert', NULL, $2, 'school', $1, $1)`,
        ['00000000-0000-4000-8000-000000000001', held],
      )

      await seedStudentStand(dataSource, { email: EMAIL })

      const stamped = (await journal()).filter((row) => row.hlc !== held).map((row) => row.hlc)

      expect(stamped).not.toHaveLength(0)
      expect(stamped.every((hlc) => hlc > held)).toBe(true)
    })

    it('journals a stand whose rows were saved before anything wrote the journal', async () => {
      const stand = await testingDataSource()
      await seedStudentStand(stand, { email: EMAIL })

      await seedStudentStand(attachSyncJournal(stand), { email: EMAIL })

      const rows: { collection: string }[] = await stand.query(
        'SELECT collection FROM sync_journal',
      )
      await stand.destroy()

      expect([...new Set(rows.map((row) => row.collection))].sort()).toEqual([
        'courses',
        'lesson_versions',
        'lessons',
        'schools',
      ])
    })

    it('delivers a document once, however often the seeder runs', async () => {
      await seedStudentStand(dataSource, { email: EMAIL })
      const first = (await journal()).length

      await seedStudentStand(dataSource, { email: EMAIL })

      expect((await journal()).length).toBe(first)
    })
  })

  describe('the first school', () => {
    it('journals the school bootstrap creates', async () => {
      const result = await bootstrap(dataSource, { email: OWNER })

      const rows = await journal()

      expect(rows).toHaveLength(1)
      expect(rows[0].collection).toBe('schools')
      expect(rows[0].doc_id).toBe(result.schoolId)
    })

    it('journals a school made before anything wrote the journal', async () => {
      const stand = await testingDataSource()
      await bootstrap(stand, { email: OWNER })

      await bootstrap(attachSyncJournal(stand), { email: OWNER })

      const rows = await stand.query('SELECT collection FROM sync_journal')
      await stand.destroy()

      expect(rows).toHaveLength(1)
    })
  })

  describe('a connection without the journal behind it', () => {
    it('writes the tables and reaches no device', async () => {
      const bare = await testingDataSource()

      await seedStudentStand(bare, { email: EMAIL })
      const rows = await bare.query('SELECT collection FROM sync_journal')
      await bare.destroy()

      expect(rows).toHaveLength(0)
    })
  })
})
