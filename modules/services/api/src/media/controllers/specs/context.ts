import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { faker } from '@faker-js/faker'
import { INestApplication } from '@nestjs/common'
import { Context, createContext } from '@vidya/api/edu/controllers/schools/specs/context'
import { RolesService, UsersService } from '@vidya/api/edu/services'
import { InMemoryStorage, StorageCall } from '@vidya/api/media/infra'
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

/** One sealed value: AES-256-GCM output and the nonce it was sealed with. */
export type SealedValue = {
  ciphertext: string
  nonce: string
}

/**
 * The envelope a profile row carries.
 *
 * One document rather than a column per sealed value, because the data key and
 * the secrets under it are written and read together or not at all. The school
 * and profile ids are the additional data, so the document does not open in a
 * row it was not sealed for.
 */
export type StorageSecrets = {
  keyVersion: number
  dek: SealedValue
  secret: SealedValue
  tokenSecret?: SealedValue
}

export type StorageProfileRow = {
  id: string
  schoolId: string
  provider: string
  endpoint: string | null
  r2AccountId: string | null
  prefix: string
  bucket: string
  accessKeyId: string
  secrets: StorageSecrets
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

  /** Moves one row's whole sealed envelope onto another row. */
  moveSecrets(fromProfileId: string, toProfileId: string): Promise<void>

  sealedSecretsOf(profileId: string): Promise<StorageSecrets>

  /** Which profile a stored file is read through, which is the one that wrote it. */
  profileIdOfMedia(mediaId: string): Promise<string | undefined>

  /** Every call the API has made to storage since the app booted, in order. */
  storageCalls(): StorageCall[]

  /** What is still sitting under the fixture bucket's school prefix. */
  objectsLeftUnder(prefix: string): string[]
}

export const createStorageContext = async (app: INestApplication): Promise<StorageContext> => {
  const base = await createContext(app)
  const rolesService = app.get(RolesService)
  const usersService = app.get(UsersService)
  const ds = app.get(DataSource)
  const storage = app.get(InMemoryStorage)

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

    storageCalls() {
      return storage.calls
    },

    objectsLeftUnder(prefix) {
      return storage
        .keysUnder(storageProfileFixture.request.bucket, prefix)
        .map((stored) => stored.key)
    },

    async profileIdOfMedia(mediaId) {
      const rows = await ds.query('SELECT "profileId" FROM "media" WHERE "id" = $1', [mediaId])
      return rows[0]?.profileId
    },

    async sealedSecretsOf(profileId) {
      const rows = await ds.query('SELECT "secrets" FROM "storage_profiles" WHERE "id" = $1', [
        profileId,
      ])
      return rows[0].secrets
    },

    async moveSecrets(fromProfileId, toProfileId) {
      await ds.query(
        'UPDATE "storage_profiles" SET "secrets" = ' +
          '(SELECT "secrets" FROM "storage_profiles" WHERE "id" = $1) WHERE "id" = $2',
        [fromProfileId, toProfileId],
      )
    },
  }
}
