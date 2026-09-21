import { AuditLogEntry, AuditLogService } from '@vidya/api/shared/services'
import { MediaId, SchoolId, UserId } from '@vidya/domain'
import { Media } from '@vidya/entities'
import { MediaInUseResponse } from '@vidya/protocol'
import { DataSource, EntityManager } from 'typeorm'

import { MediaRefusedError } from '../mediaRefusal'
import { MediaDeletionService } from './mediaDeletion.service'
import { MediaRowsService } from './mediaRows.service'
import { MediaUsageIndexService } from './mediaUsageIndex.service'
import { SchoolStorageService } from './schoolStorage.service'

const SCHOOL = 'ac1ec2ba-0aa1-4d3e-9b33-3f5f2e51a0c2' as SchoolId
const ACTOR = 'd0a2cbb2-2b6c-4f1a-8a24-1d4b8e0a6f11' as UserId

const file = (overrides: Partial<Media> = {}): Media =>
  ({
    id: '5c3f4a0e-8c4b-4a2d-9b9d-0a7cf3b21d45' as MediaId,
    schoolId: SCHOOL,
    status: 'ready',
    storageKey: 'school/one/image/cover/original.png',
    name: 'cover.png',
    kind: 'image',
    sizeBytes: '2048',
    ...overrides,
  }) as Media

/** A world where every collaborator only records what it was asked to do. */
const world = (lessons: MediaInUseResponse['lessons']) => {
  const manager = {} as EntityManager
  const steps: string[] = []
  const removed: string[] = []
  const dropped: Media[] = []
  const recorded: AuditLogEntry[] = []

  const service = new MediaDeletionService(
    { transaction: async (run: (m: EntityManager) => Promise<void>) => run(manager) } as DataSource,
    {
      deleteChargedRow: async (_m: EntityManager, media: Media) => {
        steps.push('drop-row')
        dropped.push(media)
      },
    } as unknown as MediaRowsService,
    { lessonsUsing: async () => lessons } as unknown as MediaUsageIndexService,
    {
      openProfileById: async () => ({
        storage: {
          remove: async (key: string) => {
            steps.push('remove-object')
            removed.push(key)
          },
        },
      }),
    } as unknown as SchoolStorageService,
    { record: async (entry: AuditLogEntry) => void recorded.push(entry) } as AuditLogService,
  )

  return { service, steps, removed, dropped, recorded }
}

describe('deleting a file from a library', () => {
  it('refuses the deletion with the lessons that still point at the file', async () => {
    const lessons = [
      { lessonId: 'a1', title: 'Lesson 4. Practice' },
    ] as MediaInUseResponse['lessons']
    const { service, removed, dropped, recorded } = world(lessons)

    await expect(service.deleteMedia(file(), ACTOR)).rejects.toMatchObject({
      refusal: 'media-in-use',
      details: { lessons },
    })

    expect([removed, dropped, recorded]).toEqual([[], [], []])
  })

  it('takes the object out of storage before it drops the row that names it', async () => {
    const { service, steps, removed } = world([])

    await service.deleteMedia(file(), ACTOR)

    expect(steps).toEqual(['remove-object', 'drop-row'])
    expect(removed).toEqual(['school/one/image/cover/original.png'])
  })

  it('records who deleted which file, and says the subject is a file', async () => {
    const { service, recorded } = world([])

    await service.deleteMedia(file(), ACTOR)

    expect(recorded).toEqual([
      {
        action: 'media.deleted',
        actorUserId: ACTOR,
        schoolId: SCHOOL,
        subjectType: 'media',
        subjectId: '5c3f4a0e-8c4b-4a2d-9b9d-0a7cf3b21d45',
        payload: { name: 'cover.png', kind: 'image', sizeBytes: 2048 },
      },
    ])
  })

  it('throws the refusal rather than a plain error, so the status is not a 500', async () => {
    const { service } = world([
      { lessonId: 'a1', title: 'Lesson 4' },
    ] as MediaInUseResponse['lessons'])

    await expect(service.deleteMedia(file(), ACTOR)).rejects.toBeInstanceOf(MediaRefusedError)
  })
})
