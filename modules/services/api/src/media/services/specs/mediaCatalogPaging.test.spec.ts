import { randomUUID } from 'node:crypto'

import { MediaStoragePort, StoredObject } from '@vidya/domain'
import { Media } from '@vidya/entities'

import { MediaPageSize } from '../mediaCatalog.service'
import { createMediaServices, MediaServices } from './mediaContext'

/** Storage nothing in this suite reaches: the catalogue is a query and no more. */
class UnusedStorage implements MediaStoragePort {
  async signUpload(): Promise<never> {
    throw new Error('the catalogue signs nothing')
  }

  async signRead(): Promise<never> {
    throw new Error('the catalogue signs nothing')
  }

  async signStream(): Promise<never> {
    throw new Error('the catalogue signs nothing')
  }

  async head(): Promise<StoredObject | undefined> {
    return undefined
  }

  async remove(): Promise<void> {
    throw new Error('the catalogue deletes nothing')
  }

  async *listPrefix(): AsyncIterable<StoredObject> {
    // Nothing is listed: the catalogue reads rows.
  }

  async *listUnfinished(): AsyncIterable<never> {
    // Nothing is listed: the catalogue reads rows.
  }

  async abortUnfinished(): Promise<void> {
    throw new Error('the catalogue ends nothing')
  }
}

const SHARED_INSTANT = new Date('2026-09-20T10:00:00.000Z')

/** A file already in the library, written straight in: the upload path is elsewhere. */
const storeReadyFile = async (
  services: MediaServices,
  name: string,
  createdAt = SHARED_INSTANT,
): Promise<string> => {
  const id = randomUUID()

  await services.ds.getRepository(Media).save({
    id,
    schoolId: services.schoolId,
    profileId: services.profile.id,
    kind: 'image',
    status: 'ready',
    storageKey: `school/${services.schoolId}/image/${id}/original.png`,
    externalId: null,
    name,
    mimeType: 'image/png',
    sizeBytes: '2048',
    sha256: null,
    width: null,
    height: null,
    durationMs: null,
    posterMediaId: null,
    createdBy: services.userId,
    createdAt,
    updatedAt: createdAt,
    archivedAt: null,
  } as unknown as Media)

  return id
}

describe('paging a library whose files were stored in the same instant', () => {
  let services: MediaServices

  const idsOn = async (page: number): Promise<string[]> => {
    const listed = await services.catalog.findPage({ schoolId: services.schoolId, page })
    return listed.items.map((item) => item.id)
  }

  beforeEach(async () => {
    services = await createMediaServices({ storage: new UnusedStorage() })
  })

  afterEach(async () => {
    await services.close()
  })

  it('orders files stored in one instant by id, so the pages cut one sequence', async () => {
    const stored: string[] = []
    for (let file = 0; file < MediaPageSize + 6; file += 1) {
      stored.push(await storeReadyFile(services, `lesson-cover-${file}.png`))
    }

    const listed = [...(await idsOn(1)), ...(await idsOn(2))]

    expect(listed).toEqual([...stored].sort())
  })

  it('shows every file once across the pages, none twice and none lost', async () => {
    for (let file = 0; file < MediaPageSize + 6; file += 1) {
      await storeReadyFile(services, `lesson-cover-${file}.png`)
    }

    const listed = [...(await idsOn(1)), ...(await idsOn(2))]

    expect(new Set(listed).size).toBe(MediaPageSize + 6)
  })
})

describe('searching a library by a term the term itself could widen', () => {
  let services: MediaServices

  const namesFor = async (term: string): Promise<string[]> => {
    const listed = await services.catalog.findPage({ schoolId: services.schoolId, term })
    return listed.items.map((item) => item.name)
  }

  beforeEach(async () => {
    services = await createMediaServices({ storage: new UnusedStorage() })
  })

  afterEach(async () => {
    await services.close()
  })

  it('takes a per cent sign as a character of the name, not as "anything"', async () => {
    await storeReadyFile(services, 'discount 100%.png')
    await storeReadyFile(services, 'lesson-cover.png')

    await expect(namesFor('%')).resolves.toEqual(['discount 100%.png'])
  })

  it('takes an underscore as a character of the name, not as "any character"', async () => {
    await storeReadyFile(services, 'lesson_01.png')
    await storeReadyFile(services, 'lessonX01.png')

    await expect(namesFor('lesson_01')).resolves.toEqual(['lesson_01.png'])
  })
})
