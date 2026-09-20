import { INestApplication } from '@nestjs/common'
import { GroupsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import * as domain from '@vidya/domain'
import { Group } from '@vidya/entities'
import { DataSource } from 'typeorm'

import { createEnrollmentWorld, EnrollmentWorld, placeFor, reload } from './enrollmentWorld'

/**
 * Deleting a group has to walk over the requests that asked for it.
 *
 * The database could do it with a cascade, but the journal is written by an
 * entity subscriber: a cascade clears the column and no device is ever told.
 */
describe('deleting a group', () => {
  let app: INestApplication
  let world: EnrollmentWorld

  beforeEach(async () => {
    app = await createTestingApp()
    world = await createEnrollmentWorld(app)
  })

  afterEach(async () => {
    await app.close()
  })

  const enrollmentJournalRows = async (): Promise<Record<string, unknown>[]> =>
    app
      .get(DataSource)
      .query("SELECT * FROM sync_journal WHERE collection = 'enrollments' ORDER BY global_seq")

  it('clears the wish it can no longer point at', async () => {
    const asked = await placeFor(app, world, 'pending', { preferredGroupId: world.groupId })

    await app.get(GroupsService).deleteOneBy({ id: domain.asId<domain.GroupId>(world.groupId) })

    expect((await reload(app, asked.id)).preferredGroupId).toBeNull()
    expect(
      await app.get(DataSource).getRepository(Group).findOneBy({ id: world.groupId }),
    ).toBeNull()
  })

  it('writes the clearing down, so the devices hear about it', async () => {
    await placeFor(app, world, 'pending', { preferredGroupId: world.groupId })

    const before = (await enrollmentJournalRows()).length

    await app.get(GroupsService).deleteOneBy({ id: domain.asId<domain.GroupId>(world.groupId) })

    const written = (await enrollmentJournalRows()).slice(before)

    expect(written).toHaveLength(1)
    expect((written[0].data as { preferredGroupId?: string | null }).preferredGroupId).toBeNull()
  })

  it('leaves the requests of other groups alone', async () => {
    const other = await app.get(GroupsService).create({
      courseId: domain.asId<domain.CourseId>(world.courseId),
      schoolId: domain.asId<domain.SchoolId>(world.schoolId),
      name: 'Evening',
    })

    const asked = await placeFor(app, world, 'pending', { preferredGroupId: other.id })

    await app.get(GroupsService).deleteOneBy({ id: domain.asId<domain.GroupId>(world.groupId) })

    expect((await reload(app, asked.id)).preferredGroupId).toBe(other.id)
  })
})
