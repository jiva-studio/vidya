import { INestApplication } from '@nestjs/common'
import { SchoolsService } from '@vidya/api/edu/services'
import { createTestingApp } from '@vidya/api/edu/shared'
import { School } from '@vidya/entities'

/**
 * `create` validates the entity it builds. What it persists has to be that
 * same object: a default, a `@BeforeInsert` or any other contribution of the
 * entity class exists only on the built instance, so saving the request it was
 * built from would write a row the validation never inspected.
 */
describe('EntitiesService.create', () => {
  let app: INestApplication
  let schools: SchoolsService

  beforeEach(async () => {
    app = await createTestingApp()
    schools = app.get(SchoolsService)
  })

  afterEach(() => app.close())

  it('persists the entity it built, not the request it was built from', async () => {
    const created = await schools.create({ name: 'Bhaktivedanta Gurukula' })

    expect(created).toBeInstanceOf(School)
  })

  it('returns a row the database can be asked for again', async () => {
    const created = await schools.create({ name: 'Sri Mayapur Academy' })
    const found = await schools.findOneBy({ id: created.id })

    expect(found?.name).toBe('Sri Mayapur Academy')
  })
})
