import { describe, expect, it } from 'vitest'

import { DatabaseSuspendedError } from '@/ports'

import { useSqlJsPersistence } from '../sqljs'
import { openTestDatabase } from '../testing'

describe('the sql.js database', () => {
  describe('transactions', () => {
    it('commits everything the block wrote', async () => {
      const { db } = await openTestDatabase()

      await db.transaction(async () => {
        await db.execute(
          `INSERT INTO courses (id, owner_id, school_id, name, learning_type)
           VALUES ('c-1', 'o-1', 's-1', 'Course', 'group')`,
        )
      })

      expect(await db.query('SELECT id FROM courses')).toHaveLength(1)
    })

    it('rolls the block back when it throws, and reports the original error', async () => {
      const { db } = await openTestDatabase()
      const boom = new Error('half way through')

      await expect(
        db.transaction(async () => {
          await db.execute(
            `INSERT INTO courses (id, owner_id, school_id, name, learning_type)
             VALUES ('c-1', 'o-1', 's-1', 'Course', 'group')`,
          )
          throw boom
        }),
      ).rejects.toBe(boom)

      expect(await db.query('SELECT id FROM courses')).toHaveLength(0)
    })

    it('serialises overlapping blocks instead of nesting them', async () => {
      const { db } = await openTestDatabase()

      const insert = (id: string) =>
        db.transaction(async () => {
          await db.execute(
            `INSERT INTO courses (id, owner_id, school_id, name, learning_type)
             VALUES (?, 'o-1', 's-1', 'Course', 'group')`,
            [id],
          )
        })

      await Promise.all([insert('c-1'), insert('c-2'), insert('c-3')])

      expect(await db.query('SELECT id FROM courses')).toHaveLength(3)
    })

    it('keeps taking blocks after one of them failed', async () => {
      const { db } = await openTestDatabase()

      await expect(
        db.transaction(async () => {
          throw new Error('first block')
        }),
      ).rejects.toThrow('first block')

      await db.transaction(async () => {
        await db.execute(
          `INSERT INTO courses (id, owner_id, school_id, name, learning_type)
           VALUES ('c-1', 'o-1', 's-1', 'Course', 'group')`,
        )
      })

      expect(await db.query('SELECT id FROM courses')).toHaveLength(1)
    })
  })

  describe('suspend and resume', () => {
    it('refuses a new transaction while suspended', async () => {
      const { db } = await openTestDatabase()
      await db.suspend()

      await expect(db.transaction(async () => {})).rejects.toBeInstanceOf(DatabaseSuspendedError)
    })

    it('lets the block in flight finish before it returns', async () => {
      const { db } = await openTestDatabase()
      let committed = false

      const block = db.transaction(async () => {
        await db.execute(
          `INSERT INTO courses (id, owner_id, school_id, name, learning_type)
           VALUES ('c-1', 'o-1', 's-1', 'Course', 'group')`,
        )
        committed = true
      })

      await db.suspend()

      expect(committed).toBe(true)
      await block
    })

    it('is safe to call twice, and on an idle database', async () => {
      const { db } = await openTestDatabase()

      await db.suspend()
      await expect(db.suspend()).resolves.toBeUndefined()
    })

    it('takes transactions again once resumed', async () => {
      const { db } = await openTestDatabase()

      await db.suspend()
      db.resume()

      await db.transaction(async () => {
        await db.execute(
          `INSERT INTO courses (id, owner_id, school_id, name, learning_type)
           VALUES ('c-1', 'o-1', 's-1', 'Course', 'group')`,
        )
      })

      expect(await db.query('SELECT id FROM courses')).toHaveLength(1)
    })

    it('leaves nothing unflushed: what was written survives a reopen', async () => {
      const images = new Map<string, Uint8Array>()
      const { db, persistence, dbName } = await openTestDatabase({ images })

      await db.execute(
        `INSERT INTO courses (id, owner_id, school_id, name, learning_type)
         VALUES ('c-1', 'o-1', 's-1', 'Course', 'group')`,
      )
      await db.suspend()

      const reopened = await persistence.open(dbName)
      expect(await reopened.query('SELECT id FROM courses')).toHaveLength(1)
    })
  })

  describe('durability', () => {
    it('persists a committed block without anyone calling save', async () => {
      const images = new Map<string, Uint8Array>()
      const { db, persistence, dbName } = await openTestDatabase({ images })

      await db.transaction(async () => {
        await db.execute(
          `INSERT INTO courses (id, owner_id, school_id, name, learning_type)
           VALUES ('c-1', 'o-1', 's-1', 'Course', 'group')`,
        )
      })

      const reopened = await persistence.open(dbName)
      expect(await reopened.query('SELECT id FROM courses')).toHaveLength(1)
    })

    it('gives each database name its own image', async () => {
      const persistence = useSqlJsPersistence()
      const one = await persistence.open('one')
      const two = await persistence.open('two')

      await one.execute('CREATE TABLE t (id TEXT NOT NULL PRIMARY KEY)')
      await one.save()

      const tables = await two.query('SELECT name FROM sqlite_master WHERE type = "table"')
      expect(tables).toHaveLength(0)
    })
  })
})
