import { INestApplication } from '@nestjs/common'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as protocol from '@vidya/protocol'
import * as request from 'supertest'
import { DataSource } from 'typeorm'

import { createSyncContext, journalRows, QUIZ_BLOCK_ID, RIGHT_ANSWER, SyncContext } from './context'

/**
 * AC-10a-sync: the quiz key does not travel down the sync path.
 *
 * AC-10a has guarded the REST reply since the student projection was written.
 * The journal path had no such guard and sent `version.content` verbatim, so a
 * published quiz put its answer key into `sync_journal` and from there into the
 * SQLite file on the student's phone — where no later server change can recall
 * it. Nothing failed, because the sync fixtures carried a `text` block and no
 * quiz at all.
 *
 * Two places are checked, not one. The response is what a device receives now;
 * the table is what every device that pulls later will receive, and a key that
 * is only absent from the reply is a key still waiting in the log.
 *
 * The walk is recursive and structural, exactly like the REST guard: content
 * with a `schemaVersion` this build has never seen is stored and replicated
 * verbatim (D-9), so a shape nobody anticipated has to be searched too.
 */
const KEY = 'rightAnswer'

/** Whether `KEY` appears anywhere in `node`, at any depth, under any parent. */
const holdsAnswerKey = (node: unknown): boolean => {
  if (Array.isArray(node)) return node.some(holdsAnswerKey)
  if (node === null || typeof node !== 'object') return false

  return Object.entries(node).some(([key, value]) => key === KEY || holdsAnswerKey(value))
}

const routes = protocol.Routes().sync
const DEVICE = 'device-8f2a6c14'

describe('AC-10a-sync: the answer key never reaches a device', () => {
  let app: INestApplication
  let ds: DataSource
  let ctx: SyncContext

  beforeEach(async () => {
    app = await createTestingApp()
    ds = app.get(DataSource)
    ctx = await createSyncContext(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const pull = () =>
    request(app.getHttpServer())
      .post(routes.pull())
      .auth(ctx.tokens.student, { type: 'bearer' })
      .send({ deviceId: DEVICE, cursors: {} })

  /**
   * The guard's own guard.
   *
   * A recursive search that cannot find what it is looking for passes every
   * test in this file while proving nothing, and that failure mode is silent.
   * These two cases are the only ones here that do not touch the application.
   */
  it('can find the key it is looking for', () => {
    expect(holdsAnswerKey({ a: { b: [{ [KEY]: 2 }] } })).toBe(true)
    expect(holdsAnswerKey({ a: { b: [{ answers: ['x'] }] } })).toBe(false)
  })

  it('the pull response carries no answer key at any depth', async () => {
    const response = await pull().expect(200)
    const body = response.body as protocol.PullResponse

    // The case is only worth anything if the quiz actually travelled.
    const versions = body.changes.filter((change) => change.collection === 'lesson_versions')
    expect(versions.length).toBeGreaterThan(0)
    expect(holdsAnswerKey(versions)).toBe(false)

    expect(holdsAnswerKey(body)).toBe(false)
  })

  it('the journal itself carries no answer key at any depth', async () => {
    // The response is one device's view; the table is what every device that
    // has not pulled yet will be handed.
    const rows = await journalRows(ds)
    const versions = rows.filter((row) => row.collection === 'lesson_versions')

    expect(versions.length).toBeGreaterThan(0)
    expect(holdsAnswerKey(versions)).toBe(false)
  })

  it('keeps the rest of the quiz, so the lesson is still answerable', async () => {
    const response = await pull().expect(200)
    const body = response.body as protocol.PullResponse

    // Withholding the key must not be done by dropping the block: the student
    // still has to see the question and the options to answer at all.
    const quizzes = blocksOf(body).filter((block) => block.id === QUIZ_BLOCK_ID)

    expect(quizzes).toHaveLength(1)
    expect(quizzes[0]).toEqual({
      id: QUIZ_BLOCK_ID,
      type: 'quiz',
      question: 'Who speaks the Gita?',
      answers: ['Arjuna', 'Sanjaya', 'Krishna'],
    })

    // And the fixture really does carry a key on the server side, or the case
    // above would be green against content that never had one.
    expect(RIGHT_ANSWER).toBe(2)
  })
})

interface Block {
  id: string
  type: string
}

/** Every block of every section of every lesson version in the page. */
const blocksOf = (body: protocol.PullResponse): Block[] =>
  body.changes
    .filter((change) => change.collection === 'lesson_versions')
    .flatMap((change) => sectionsOf(change.data))
    .flatMap((section) => (Array.isArray(section.blocks) ? (section.blocks as Block[]) : []))

const sectionsOf = (data: unknown): { blocks?: unknown }[] => {
  if (data === null || typeof data !== 'object') return []
  const content = (data as { content?: unknown }).content

  if (content === null || typeof content !== 'object') return []
  const sections = (content as { sections?: unknown }).sections

  return Array.isArray(sections) ? (sections as { blocks?: unknown }[]) : []
}
