import { describe, expect, it } from 'vitest'

import type { IDatabase } from '../../../ports'
import { mutate, queryMany, queryOne, runInTransaction, SqlRepository } from '../repository'
import { openTestDatabase } from '../testing'

interface CourseRow {
  id: string
  name: string
}

const toName = (row: CourseRow): string => row.name

const insertCourse = (db: IDatabase, id: string, name: string) =>
  db.execute(
    `INSERT INTO courses (id, owner_id, school_id, name, learning_type)
     VALUES (?, 'o-1', 's-1', ?, 'group')`,
    [id, name],
  )

describe('the SQL repository helpers', () => {
  describe('queryOne', () => {
    it('maps the first row', async () => {
      const { db } = await openTestDatabase()
      await insertCourse(db, 'c-1', 'Bhagavad Gita')

      const name = await queryOne(db, 'SELECT id, name FROM courses WHERE id = ?', ['c-1'], toName)
      expect(name).toBe('Bhagavad Gita')
    })

    it('returns null when nothing matched', async () => {
      const { db } = await openTestDatabase()

      const name = await queryOne(db, 'SELECT id, name FROM courses WHERE id = ?', ['gone'], toName)
      expect(name).toBeNull()
    })
  })

  describe('queryMany', () => {
    it('maps every row', async () => {
      const { db } = await openTestDatabase()
      await insertCourse(db, 'c-1', 'One')
      await insertCourse(db, 'c-2', 'Two')

      const names = await queryMany(db, 'SELECT id, name FROM courses ORDER BY id', [], toName)
      expect(names).toEqual(['One', 'Two'])
    })

    it('returns an empty list rather than null', async () => {
      const { db } = await openTestDatabase()

      expect(await queryMany(db, 'SELECT id, name FROM courses', [], toName)).toEqual([])
    })
  })

  describe('mutate', () => {
    it('writes and flushes in one call', async () => {
      const images = new Map<string, Uint8Array>()
      const { db, persistence, dbName } = await openTestDatabase({ images })

      await mutate(
        db,
        `INSERT INTO courses (id, owner_id, school_id, name, learning_type)
         VALUES ('c-1', 'o-1', 's-1', 'Course', 'group')`,
      )

      const reopened = await persistence.open(dbName)
      expect(await reopened.query('SELECT id FROM courses')).toHaveLength(1)
    })
  })

  describe('runInTransaction', () => {
    it('hands back what the block returned', async () => {
      const { db } = await openTestDatabase()

      const written = await runInTransaction(db, async () => {
        await insertCourse(db, 'c-1', 'One')
        return 'c-1'
      })

      expect(written).toBe('c-1')
    })

    it('writes a page of rows and the position it reached in one block', async () => {
      const { db } = await openTestDatabase()

      await runInTransaction(db, async () => {
        await insertCourse(db, 'c-1', 'One')
        await db.execute(
          `INSERT INTO sync_scopes (owner_id, kind, id, cursor)
           VALUES ('o-1', 'course', 'c-1', 42)`,
        )
      })

      const scopes = await db.query<{ cursor: number }>('SELECT cursor FROM sync_scopes')
      expect(scopes[0]!.cursor).toBe(42)
    })

    it('rolls the position back with the rows when the block fails', async () => {
      const { db } = await openTestDatabase()
      const boom = new Error('page failed')

      await expect(
        runInTransaction(db, async () => {
          await insertCourse(db, 'c-1', 'One')
          await db.execute(
            `INSERT INTO sync_scopes (owner_id, kind, id, cursor)
             VALUES ('o-1', 'course', 'c-1', 42)`,
          )
          throw boom
        }),
      ).rejects.toBe(boom)

      expect(await db.query('SELECT id FROM courses')).toHaveLength(0)
      expect(await db.query('SELECT cursor FROM sync_scopes')).toHaveLength(0)
    })
  })

  describe('SqlRepository', () => {
    class Courses extends SqlRepository {
      findName(id: string): Promise<string | null> {
        return this.queryOne('SELECT id, name FROM courses WHERE id = ?', [id], toName)
      }

      listNames(): Promise<string[]> {
        return this.queryMany('SELECT id, name FROM courses ORDER BY id', [], toName)
      }

      add(id: string, name: string): Promise<void> {
        return this.mutate(
          `INSERT INTO courses (id, owner_id, school_id, name, learning_type)
           VALUES (?, 'o-1', 's-1', ?, 'group')`,
          [id, name],
        )
      }
    }

    it('binds one database for the repository body', async () => {
      const { db } = await openTestDatabase()
      const courses = new Courses(db)

      await courses.add('c-1', 'One')
      await courses.add('c-2', 'Two')

      expect(await courses.findName('c-1')).toBe('One')
      expect(await courses.listNames()).toEqual(['One', 'Two'])
    })
  })
})
