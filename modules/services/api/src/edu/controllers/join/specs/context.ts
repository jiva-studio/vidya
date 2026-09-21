import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { SchoolsService } from '@vidya/api/edu/services'
import { School } from '@vidya/entities'

/**
 * Two schools: one that hands out a link, one that never asked for one.
 *
 * The code is written straight onto the row rather than minted, because the
 * route under test is the reader. Which school a code belongs to is the whole
 * question here, so the fixture states it instead of drawing it.
 */
export type Context = {
  listed: { school: School; code: string }
  unlisted: { school: School }
}

export const LISTED_CODE = 'AB3K7Q'

export const createContext = async (app: INestApplication): Promise<Context> => {
  const schools = app.get(SchoolsService)

  const listed = await schools.create({
    name: faker.company.name(),
    logoUrl: 'https://cdn.example.org/logo.png',
    description: 'Scripture, kirtan and practice.',
  })

  const unlisted = await schools.create({
    name: faker.company.name(),
    description: 'No link to this one exists anywhere.',
  })

  await schools.updateOneBy({ id: listed.id }, { code: LISTED_CODE })

  return {
    listed: { school: await schools.findOneBy({ id: listed.id }), code: LISTED_CODE },
    unlisted: { school: await schools.findOneBy({ id: unlisted.id }) },
  }
}
