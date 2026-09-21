import type {
  BlockId,
  BlockStateId,
  EnrollmentId,
  HomeworkId,
  LessonVersionId,
  SchoolId,
  SectionId,
  SyncPayload,
  SyncCollection,
} from '@vidya/domain'
import { asId, parseIsoDateTime } from '@vidya/domain'
import { beforeEach, describe, expect, it } from 'vitest'

import type { IBlockStateRepository, IDatabase, IHomeworkRepository } from '../../../../ports'
import { fixedClock, openTestDatabase } from '../../../persistence/testing'
import { createSqlBlockStateRepository } from '../blockStatesRepository.sql'
import { createSqlEnrollmentRepository } from '../enrollmentsRepository.sql'
import { createSqlHomeworkRepository } from '../homeworkRepository.sql'
import { createSqlOutboxRepository } from '../outboxRepository.sql'
import { createSqlSyncApplyRepository } from '../syncApplyRepository.sql'
import { withSyncJournaling } from '../syncJournalDecorator'

const OWNER = '7b3d5e90-1c44-4a2b-8f61-2d9e0c4a5b73'
const SCHOOL = asId<SchoolId>('5c1f2e73-9a48-4c1d-b0e6-8f3a2d7c4915')
const PLACE = asId<EnrollmentId>('4a7e2c96-0d13-4b58-9f26-3c8b1a5e70d4')
const VERSION = asId<LessonVersionId>('2f8c1b47-6d09-4e53-a71b-5c0d9a3e6482')
const SECTION = asId<SectionId>('8e1a4d72-3c56-4b90-8f27-6a1d5c3b9e04')
const BLOCK = asId<BlockId>('3c9f7b21-5e08-4a46-9d13-7b2e4c6a1f85')
const ANSWER = asId<HomeworkId>('6b5d3e19-2a74-4c81-b0f6-9e8c1d4a7325')
const STATE = asId<BlockStateId>('1a2b3c4d-5e6f-4071-8293-a4b5c6d7e8f9')

let db: IDatabase
let blockStates: IBlockStateRepository
let homework: IHomeworkRepository
let seq = 0

const openDevice = () => {
  const outbox = createSqlOutboxRepository({ db, now: fixedClock })
  const apply = createSqlSyncApplyRepository({ db, ownerId: () => OWNER, now: fixedClock })

  return withSyncJournaling(
    {
      enrollments: createSqlEnrollmentRepository({ db, ownerId: () => OWNER, now: fixedClock }),
      homework: createSqlHomeworkRepository({ db, ownerId: () => OWNER, now: fixedClock }),
      blockStates: createSqlBlockStateRepository({ db, ownerId: () => OWNER, now: fixedClock }),
    },
    {
      db,
      outbox,
      apply,
      deviceId: async () => 'device-a',
      ownerId: () => OWNER,
      nowMs: () => Date.parse(fixedClock()),
    },
  )
}

/** Write what a pull of the student's own scope brings down. */
const arrives = async (
  collection: SyncCollection,
  docId: string,
  data: SyncPayload,
): Promise<void> => {
  seq += 1
  const apply = createSqlSyncApplyRepository({ db, ownerId: () => OWNER, now: fixedClock })
  const hlc = `00178968920000${seq}:00000:server`
  const stored = await apply.getLocalDoc(collection, docId)

  await apply.applyRemote(
    collection,
    { docId, hlc, deleted: false, data: { ...stored?.data, ...data, id: docId } },
    hlc,
    { kind: 'user', id: OWNER },
  )
}

const answered = (answer: number) => ({
  id: STATE,
  schoolId: SCHOOL,
  enrollmentId: PLACE,
  lessonVersionId: VERSION,
  blockId: BLOCK,
  state: { type: 'quiz', answer },
})

beforeEach(async () => {
  seq = 0
  db = (await openTestDatabase()).db
  const device = openDevice()
  blockStates = device.blockStates
  homework = device.homework
})

describe("the server's verdict on a quiz answer", () => {
  it('is read back beside the answer it marks', async () => {
    await blockStates.save(answered(1))
    await arrives('block_states', STATE, {
      ...answered(1),
      verdict: { correct: false, explanation: 'The first one opens it.' },
      updatedAt: fixedClock(),
    })

    expect(
      await blockStates.getByKey({ enrollmentId: PLACE, lessonVersionId: VERSION, blockId: BLOCK }),
    ).toMatchObject({ verdict: { correct: false, explanation: 'The first one opens it.' } })
  })

  it('is absent while nothing has marked the answer', async () => {
    const saved = await blockStates.save(answered(0))

    expect(saved.verdict).toBeNull()
  })

  it('survives a later write of the answer, which does not own the field', async () => {
    await blockStates.save(answered(1))
    await arrives('block_states', STATE, {
      ...answered(1),
      verdict: { correct: true },
      updatedAt: fixedClock(),
    })

    await blockStates.save(answered(1))

    expect(
      await blockStates.getByKey({ enrollmentId: PLACE, lessonVersionId: VERSION, blockId: BLOCK }),
    ).toMatchObject({ verdict: { correct: true } })
  })
})

describe("the reviewer's comment on an answer", () => {
  const write = (text: string) =>
    homework.saveAnswer({
      id: ANSWER,
      schoolId: SCHOOL,
      enrollmentId: PLACE,
      lessonVersionId: VERSION,
      sectionId: SECTION,
      text,
    })

  const returnedWithWords = () =>
    arrives('homework', ANSWER, {
      status: 'returned',
      grade: 40,
      comment: 'Say more about the second verse.',
      reviewedAt: parseIsoDateTime('2026-09-19T00:00:00.000Z'),
    })

  it('is read back beside the answer it was written on', async () => {
    await write('My first go.')
    await homework.submit(ANSWER, fixedClock())
    await returnedWithWords()

    expect(await homework.getById(ANSWER)).toMatchObject({
      status: 'returned',
      grade: 40,
      comment: 'Say more about the second verse.',
    })
  })

  it('is absent on an answer nobody has reviewed', async () => {
    const saved = await write('My first go.')

    expect(saved.comment).toBeNull()
  })

  it('survives the correction the student writes after it', async () => {
    await write('My first go.')
    await homework.submit(ANSWER, fixedClock())
    await returnedWithWords()

    await write('My second go.')

    expect(await homework.getById(ANSWER)).toMatchObject({
      text: 'My second go.',
      comment: 'Say more about the second verse.',
    })
  })
})
