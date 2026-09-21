import { AuditLogEntry, AuditLogService } from '@vidya/api/shared/services'
import { MediaId, SchoolId, StorageProfileId, UserId } from '@vidya/domain'
import { Media } from '@vidya/entities'
import { MediaInUseResponse } from '@vidya/protocol'
import { DataSource, EntityManager } from 'typeorm'

import { MediaRefusedError } from '../mediaRefusal'
import { MediaDeletionService } from './mediaDeletion.service'
import { MediaRowsService } from './mediaRows.service'
import { MediaUsageIndexService } from './mediaUsageIndex.service'
import { SchoolStorageService } from './schoolStorage.service'

const SCHOOL = 'ac1ec2ba-0aa1-4d3e-9b33-3f5f2e51a0c2' as SchoolId
const PROFILE = '7b0c5d3a-4e2f-4a1b-9c8d-6e5f4a3b2c1d' as StorageProfileId
const ACTOR = 'd0a2cbb2-2b6c-4f1a-8a24-1d4b8e0a6f11' as UserId

const file = (overrides: Partial<Media> = {}): Media =>
  ({
    id: '5c3f4a0e-8c4b-4a2d-9b9d-0a7cf3b21d45' as MediaId,
    schoolId: SCHOOL,
    profileId: PROFILE,
    status: 'ready',
    storageKey: 'school/one/image/cover/original.png',
    name: 'cover.png',
    kind: 'image',
    sizeBytes: '2048',
    ...overrides,
  }) as Media

/**
 * A world that records what each collaborator was asked to do and which
 * transaction it was asked in: a double that drops the `manager` it is handed
 * cannot tell a deletion inside the transaction from one beside it.
 */
const world = (lessons: MediaInUseResponse['lessons']) => {
  const manager = { name: 'the deletion transaction' } as unknown as EntityManager
  const steps: string[] = []
  const removed: string[] = []
  const archived: { mediaId: MediaId; manager?: EntityManager }[] = []
  const dropped: { mediaId: MediaId; manager?: EntityManager }[] = []
  const recorded: { entry: AuditLogEntry; manager?: EntityManager }[] = []

  const service = new MediaDeletionService(
    { transaction: async (run: (m: EntityManager) => Promise<void>) => run(manager) } as DataSource,
    {
      archiveRow: async (mediaId: MediaId, inside?: EntityManager) => {
        steps.push('archive-row')
        archived.push({ mediaId, manager: inside })
      },
      deleteRow: async (mediaId: MediaId, inside?: EntityManager) => {
        steps.push('drop-row')
        dropped.push({ mediaId, manager: inside })
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
    {
      record: async (entry: AuditLogEntry, inside?: EntityManager) =>
        void recorded.push({ entry, manager: inside }),
    } as AuditLogService,
  )

  return { service, manager, steps, removed, archived, dropped, recorded }
}

describe('deleting a file from a library', () => {
  it('refuses the deletion with the lessons that still point at the file', async () => {
    const lessons = [
      { lessonId: 'a1', title: 'Lesson 4. Practice' },
    ] as MediaInUseResponse['lessons']
    const { service, removed, archived, dropped, recorded } = world(lessons)

    await expect(service.deleteMedia(file(), ACTOR)).rejects.toMatchObject({
      refusal: 'media-in-use',
      details: { lessons },
    })

    expect([removed, archived, dropped, recorded]).toEqual([[], [], [], []])
  })

  it('stops charging for the row before it takes the object out of storage', async () => {
    const { service, steps, removed } = world([])

    await service.deleteMedia(file(), ACTOR)

    expect(steps).toEqual(['archive-row', 'remove-object', 'drop-row'])
    expect(removed).toEqual(['school/one/image/cover/original.png'])
  })

  it('archives the row in the same transaction that writes the trail', async () => {
    const { service, manager, archived, recorded } = world([])

    await service.deleteMedia(file(), ACTOR)

    expect(archived).toEqual([{ mediaId: '5c3f4a0e-8c4b-4a2d-9b9d-0a7cf3b21d45', manager }])
    expect(recorded.map((call) => call.manager)).toEqual([manager])
  })

  it('records who deleted which file, and which object in which bucket it was', async () => {
    const { service, recorded } = world([])

    await service.deleteMedia(file(), ACTOR)

    expect(recorded.map((call) => call.entry)).toEqual([
      {
        action: 'media.deleted',
        actorUserId: ACTOR,
        schoolId: SCHOOL,
        subjectType: 'media',
        subjectId: '5c3f4a0e-8c4b-4a2d-9b9d-0a7cf3b21d45',
        payload: {
          name: 'cover.png',
          kind: 'image',
          sizeBytes: 2048,
          profileId: PROFILE,
          storageKey: 'school/one/image/cover/original.png',
        },
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
