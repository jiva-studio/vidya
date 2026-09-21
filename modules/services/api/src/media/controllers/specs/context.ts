import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { Context, createContext } from '@vidya/api/edu/controllers/schools/specs/context'
import { RolesService, UsersService } from '@vidya/api/edu/services'
import * as domain from '@vidya/domain'
import { Role, User } from '@vidya/entities'
import * as protocol from '@vidya/protocol'
import { DataSource } from 'typeorm'

/**
 * The wire fixtures, read from disk rather than imported: they are data shared
 * with the clients, not a module of this service. The package is asked where it
 * lives because a mutation run copies this service several levels deeper.
 */
const FIXTURES = join(
  dirname(require.resolve('@vidya/protocol/package.json')),
  '__fixtures__',
  'media',
)

const fixture = <T>(name: string): T =>
  JSON.parse(readFileSync(join(FIXTURES, `${name}.json`), 'utf8')) as T

type StorageProfileFixture = {
  request: protocol.UpsertStorageProfileRequest & { secret: string }
  response: Record<string, unknown>
}

type RefusalCase = {
  endpoint: string
  status: number
  response: Record<string, unknown>
}

export const storageProfileFixture = fixture<StorageProfileFixture>('storage-profile')

export const refusalFor = (endpoint: string, key: string): RefusalCase => {
  const cases = fixture<{ cases: RefusalCase[] }>('refusals').cases
  const found = cases.find(
    (c) => c.endpoint === endpoint && (c.response.message as string[])?.includes(key),
  )

  if (!found) throw new Error(`No refusal fixture for ${endpoint} / ${key}`)
  return found
}

/**
 * A base64 master key of the right length, committed on purpose: it must never
 * protect anything real, and a per-run random key would buy nothing here.
 */
export const TEST_MASTER_KEY = Buffer.alloc(32, 7).toString('base64')

/** The six keys the technical specialist template carries. */
const TECHNICAL_SPECIALIST: domain.PermissionKey[] = [
  'storage:read',
  'storage:update',
  'media:read',
  'media:upload',
  'media:delete',
  'schools:read',
]

export type StorageProfileRow = {
  id: string
  schoolId: string
  prefix: string
  bucket: string
  accessKeyId: string
  secretCiphertext: Buffer | null
  secretNonce: Buffer | null
  verifiedAt: Date | null
  verifyError: string | null
  retiredAt: Date | null
}

export type StorageContext = Context & {
  /** A technical specialist in school two, so both schools can hold a profile. */
  two: Context['two'] & {
    users: Context['two']['users'] & { technician: User }
    roles: Context['two']['roles'] & { technician: Role }
  }

  /** Credentials the in-memory storage fake accepts, aimed at the given school. */
  credentialsFor(schoolId: string): protocol.UpsertStorageProfileRequest

  profileRows(schoolId: string): Promise<StorageProfileRow[]>
  currentProfileIdOf(schoolId: string): Promise<string | null>

  /** Moves one row's secret ciphertext onto another row, nonce included. */
  moveSecretCiphertext(fromProfileId: string, toProfileId: string): Promise<void>
}

export const createStorageContext = async (app: INestApplication): Promise<StorageContext> => {
  const base = await createContext(app)
  const rolesService = app.get(RolesService)
  const usersService = app.get(UsersService)
  const ds = app.get(DataSource)

  const twoTechnicianRole = await rolesService.create({
    name: 'Two :: Technical specialist',
    description: 'Storage role for school two',
    permissions: TECHNICAL_SPECIALIST,
    schoolId: base.two.school.id,
  })

  const twoTechnicianUser = await usersService.create({
    email: faker.internet.email(),
    roles: [twoTechnicianRole],
  })

  return {
    ...base,
    two: {
      ...base.two,
      users: { ...base.two.users, technician: twoTechnicianUser },
      roles: { ...base.two.roles, technician: twoTechnicianRole },
    },

    credentialsFor(schoolId) {
      const { prefix: _ignored, ...credentials } = storageProfileFixture.request
      return { ...credentials, prefix: `school/${schoolId}` }
    },

    async profileRows(schoolId) {
      return ds.query(
        'SELECT * FROM "storage_profiles" WHERE "schoolId" = $1 ORDER BY "createdAt" ASC',
        [schoolId],
      )
    },

    async currentProfileIdOf(schoolId) {
      const rows = await ds.query(
        'SELECT "currentStorageProfileId" FROM "schools" WHERE "id" = $1',
        [schoolId],
      )
      return rows[0]?.currentStorageProfileId ?? null
    },

    async moveSecretCiphertext(fromProfileId, toProfileId) {
      await ds.query(
        'UPDATE "storage_profiles" SET "secretCiphertext" = ' +
          '(SELECT "secretCiphertext" FROM "storage_profiles" WHERE "id" = $1), ' +
          '"secretNonce" = (SELECT "secretNonce" FROM "storage_profiles" WHERE "id" = $1) ' +
          'WHERE "id" = $2',
        [fromProfileId, toProfileId],
      )
    },
  }
}
