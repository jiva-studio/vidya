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
const masterKey = (value: string | undefined): Buffer | null => {
  if (!value) return null

  const key = Buffer.from(value, 'base64')

  if (key.length !== MASTER_KEY_BYTES) {
    throw new Error(
      `VIDYA_MEDIA_MASTER_KEY decodes to ${key.length} bytes; AES-256-GCM needs exactly ` +
        `${MASTER_KEY_BYTES}, base64-encoded.`,
    )
  }

  return key
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
export default registerAs('media', () => ({
  masterKey: masterKey(process.env.VIDYA_MEDIA_MASTER_KEY),
  keyVersion: positive(process.env.VIDYA_MEDIA_MASTER_KEY_VERSION, 1),

  endpointAllowlist: [
    ...BUILTIN_ENDPOINT_SUFFIXES,
    ...suffixes(process.env.VIDYA_MEDIA_ENDPOINT_ALLOWLIST),
  ],

  driver:
    process.env.VIDYA_MEDIA_STORAGE_DRIVER ?? (process.env.NODE_ENV === 'test' ? 'memory' : 's3'),

  // The storage of the installation, which every school without credentials of
  // its own writes into under `school/<schoolId>`.
  defaultStorage: {
    endpoint: process.env.VIDYA_MEDIA_DEFAULT_ENDPOINT ?? '',
    region: process.env.VIDYA_MEDIA_DEFAULT_REGION ?? '',
    bucket: process.env.VIDYA_MEDIA_DEFAULT_BUCKET ?? '',
    accessKeyId: process.env.VIDYA_MEDIA_DEFAULT_ACCESS_KEY_ID ?? '',
    secret: process.env.VIDYA_MEDIA_DEFAULT_SECRET ?? '',
    publicBaseUrl: process.env.VIDYA_MEDIA_DEFAULT_PUBLIC_BASE_URL ?? null,
  },

  maxImageBytes: positive(process.env.VIDYA_MEDIA_MAX_IMAGE_BYTES, 10_485_760),
  maxAudioBytes: positive(process.env.VIDYA_MEDIA_MAX_AUDIO_BYTES, 209_715_200),
  maxVideoBytes: positive(process.env.VIDYA_MEDIA_MAX_VIDEO_BYTES, 2_147_483_648),
  hashLimitBytes: positive(process.env.VIDYA_MEDIA_HASH_LIMIT_BYTES, 268_435_456),

  // Only the storage of the installation carries a quota by default: a school
  // paying for its own bucket is limited by its provider, not by us.
  defaultQuotaBytes: positive(process.env.VIDYA_MEDIA_DEFAULT_QUOTA_BYTES, 5_368_709_120),
}))
