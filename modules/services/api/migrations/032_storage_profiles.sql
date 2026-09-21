-- Where a school's files live, and with what keys.
--
-- A profile is never edited: new keys retire this row and the school points at
-- a new one, because files already uploaded are read through the profile that
-- wrote them. Rotating a key under published content would otherwise break
-- every file a school has.
--
-- `provider` is named rather than inferred, and the endpoint is derived from it
-- wherever it can be — `s3.<region>.amazonaws.com`,
-- `<region>-s3.storage.bunnycdn.com`, `<account>.r2.cloudflarestorage.com`. A
-- school picks its provider and types keys, not a URL. Only `s3-compatible`
-- carries an endpoint of its own, and that is the one case the SSRF allowlist
-- has to police: a free-form address is one the API dials from inside its own
-- network. rclone models the same set the same way, for the same reason.
--
-- The sealed keys live in one `secrets` document rather than in three pairs of
-- bytea columns. What is sealed is one envelope — a data key wrapped by the
-- installation's master key, and under it the storage secret and the CDN token
-- secret — so splitting it across the schema only spread the encryption over
-- six columns that must be written and read together or not at all.
--
-- What this table does NOT hold, on purpose:
--
--   * how much a school has stored. That is `SUM(sizeBytes)` over its ready
--     files, which cannot drift; a counter here already produced a defect, by
--     being incremented on the profile that wrote the file while the quota was
--     read from the profile that is current, so a key rotated on the same
--     bucket reset the count to zero. A stored counter earns its keep at
--     millions of rows, not at a school library's thousands.
--   * the video provider. A transcoding library is a second vendor
--     relationship, not a bucket's credentials, and it gets its own table when
--     one is needed.

CREATE TABLE "storage_profiles" (
  "id"            uuid NOT NULL DEFAULT uuid_generate_v4(),
  "schoolId"      uuid NOT NULL,

  -- 'aws' | 'bunny' | 'r2' | 's3-compatible'
  "provider"      character varying NOT NULL,

  "region"        character varying NOT NULL DEFAULT '',
  "bucket"        character varying NOT NULL,
  "prefix"        character varying NOT NULL DEFAULT '',
  "accessKeyId"   character varying NOT NULL,

  -- Only 's3-compatible' fills this in; for the named providers it is derived.
  "endpoint"      character varying,

  -- R2 addresses by account and has no regions, so it cannot borrow `region`:
  -- a column that means one thing for one provider and another for the next is
  -- how a wrong host gets built.
  "r2AccountId"   character varying,

  -- AES-256-GCM, one envelope: `{ keyVersion, dek, secret, tokenSecret }`,
  -- each sealed value carrying its own nonce. The school and profile ids are
  -- the AAD, so a document carried into another row will not open.
  "secrets"       json NOT NULL,

  -- Derived from whether a CDN host is present, never chosen by a person.
  "delivery"      character varying NOT NULL DEFAULT 'presigned',
  "publicBaseUrl" character varying,

  -- The last probe of these keys. Both null means nobody ever probed them,
  -- which is what a profile lent from the installation looks like.
  "verifiedAt"    TIMESTAMPTZ,
  "verifyError"   character varying,

  "retiredAt"     TIMESTAMPTZ,
  "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "PK_storage_profiles" PRIMARY KEY ("id"),
  CONSTRAINT "FK_storage_profiles_school" FOREIGN KEY ("schoolId")
    REFERENCES "schools" ("id") ON DELETE CASCADE
);

CREATE INDEX "IDX_storage_profiles_school" ON "storage_profiles" ("schoolId");

-- A school has one live profile at a time, and the database is what says so:
-- two grants asking at once must not lend the same school two buckets.
-- Declared after the plain index on purpose — pg-mem matches a partial index by
-- its columns without reading the predicate, and finds this one first
-- otherwise.
CREATE UNIQUE INDEX "UQ_storage_profiles_live_per_school"
  ON "storage_profiles" ("schoolId")
  WHERE "retiredAt" IS NULL;

-- What a school may store. Policy, not measurement: null means no ceiling of
-- ours, which is what a school paying its own provider gets.
CREATE TABLE "school_storage_quotas" (
  "schoolId"   uuid NOT NULL,
  "quotaBytes" bigint,
  "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT "PK_school_storage_quotas" PRIMARY KEY ("schoolId"),
  CONSTRAINT "FK_school_storage_quotas_school" FOREIGN KEY ("schoolId")
    REFERENCES "schools" ("id") ON DELETE CASCADE
);

ALTER TABLE "schools"
  ADD COLUMN "currentStorageProfileId" uuid;

ALTER TABLE "schools"
  ADD CONSTRAINT "FK_schools_current_storage_profile"
  FOREIGN KEY ("currentStorageProfileId") REFERENCES "storage_profiles" ("id")
  ON DELETE SET NULL;
