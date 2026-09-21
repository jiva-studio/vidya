import { registerAs } from '@nestjs/config'

/** Suffixes every installation trusts, because they are the providers we drive. */
const BUILTIN_ENDPOINT_SUFFIXES = [
  'amazonaws.com',
  'storage.bunnycdn.com',
  'r2.cloudflarestorage.com',
]

const MASTER_KEY_BYTES = 32

const positive = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

const suffixes = (value: string | undefined): string[] =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase().replace(/^\.+/, ''))
    .filter((entry) => entry.length > 0)

/**
 * Reads the master key, refusing a key that cannot do the job it is given.
 *
 * Absence is not an error here: an installation where no school has handed
 * over credentials has nothing to seal, and demanding a key it will never use
 * would stop a working deployment for nothing. The refusal for a key that is
 * missing while sealed profiles exist belongs where the profiles can be
 * counted, which is not a config factory.
 */
const masterKey = (value: string | undefined, name: string): Buffer | null => {
  if (!value) return null

  const key = Buffer.from(value, 'base64')

  if (key.length !== MASTER_KEY_BYTES) {
    throw new Error(
      `${name} decodes to ${key.length} bytes; AES-256-GCM needs exactly ` +
        `${MASTER_KEY_BYTES}, base64-encoded.`,
    )
  }

  return key
}

/**
 * Every master key the installation still holds, by the version that names it.
 *
 * A document records the version that wrapped it and is opened under that key,
 * so a rotation means installing the new key beside the old one:
 * `VIDYA_MEDIA_MASTER_KEY` is the one new documents are sealed under, and
 * `VIDYA_MEDIA_MASTER_KEYS` carries `<version>:<base64>` for the ones that are
 * still needed to read what has not been re-sealed. Nothing here re-seals
 * anything, so an old key can never be removed from this list — a key dropped
 * while a profile still names it makes that profile's credentials unreadable.
 */
const masterKeys = (current: Buffer | null, version: number): Record<number, Buffer> => {
  const keyring: Record<number, Buffer> = {}

  for (const entry of (process.env.VIDYA_MEDIA_MASTER_KEYS ?? '').split(',')) {
    const [named, encoded] = entry.split(':')
    if (!encoded) continue

    const at = Number(named.trim())
    const key = masterKey(encoded.trim(), 'VIDYA_MEDIA_MASTER_KEYS')

    if (!Number.isInteger(at) || at <= 0 || !key) {
      throw new Error(
        'VIDYA_MEDIA_MASTER_KEYS holds `<version>:<base64 key>` entries, comma-separated.',
      )
    }

    keyring[at] = key
  }

  if (current) keyring[version] = current

  return keyring
}

/**
 * The bucket the installation lends, or nothing when it has none.
 *
 * Absent rather than a record of empty strings: a school is lent a bucket only
 * where there is one to lend, and a profile assembled out of blank credentials
 * would be a row promising an upload that cannot land.
 */
const defaultStorage = () => {
  const endpoint = process.env.VIDYA_MEDIA_DEFAULT_ENDPOINT
  const bucket = process.env.VIDYA_MEDIA_DEFAULT_BUCKET
  const accessKeyId = process.env.VIDYA_MEDIA_DEFAULT_ACCESS_KEY_ID
  const secret = process.env.VIDYA_MEDIA_DEFAULT_SECRET

  if (!endpoint || !bucket || !accessKeyId || !secret) return null

  return {
    endpoint,
    region: process.env.VIDYA_MEDIA_DEFAULT_REGION ?? '',
    bucket,
    accessKeyId,
    secret,
    publicBaseUrl: process.env.VIDYA_MEDIA_DEFAULT_PUBLIC_BASE_URL ?? null,
  }
}

/**
 * What the media context needs from deployment: the key that seals a school's
 * credentials, the addresses it may be pointed at, and the ceilings an upload
 * is refused by.
 *
 * The storage driver is named rather than inferred at every call site: a suite
 * runs against the in-memory fake, a deployment against S3, and nothing else
 * decides which.
 */
export default registerAs('media', () => {
  const current = masterKey(process.env.VIDYA_MEDIA_MASTER_KEY, 'VIDYA_MEDIA_MASTER_KEY')
  const keyVersion = positive(process.env.VIDYA_MEDIA_MASTER_KEY_VERSION, 1)

  return {
    masterKey: current,
    keyVersion,
    masterKeys: masterKeys(current, keyVersion),

    endpointAllowlist: [
      ...BUILTIN_ENDPOINT_SUFFIXES,
      ...suffixes(process.env.VIDYA_MEDIA_ENDPOINT_ALLOWLIST),
    ],

    driver:
      process.env.VIDYA_MEDIA_STORAGE_DRIVER ?? (process.env.NODE_ENV === 'test' ? 'memory' : 's3'),

    // The storage of the installation, which every school without credentials of
    // its own writes into under `school/<schoolId>`.
    defaultStorage: defaultStorage(),

    maxImageBytes: positive(process.env.VIDYA_MEDIA_MAX_IMAGE_BYTES, 10_485_760),
    maxAudioBytes: positive(process.env.VIDYA_MEDIA_MAX_AUDIO_BYTES, 209_715_200),
    maxVideoBytes: positive(process.env.VIDYA_MEDIA_MAX_VIDEO_BYTES, 2_147_483_648),
    hashLimitBytes: positive(process.env.VIDYA_MEDIA_HASH_LIMIT_BYTES, 268_435_456),

    // Only the storage of the installation carries a quota by default: a school
    // paying for its own bucket is limited by its provider, not by us.
    defaultQuotaBytes: positive(process.env.VIDYA_MEDIA_DEFAULT_QUOTA_BYTES, 5_368_709_120),
  }
})
