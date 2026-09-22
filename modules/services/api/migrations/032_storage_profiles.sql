-- Where a school's files live, and with what keys.
--
-- A profile is never edited: new keys retire this row and the school points at a
-- new one, because files already uploaded are read through the profile that
-- wrote them. Why the table is shaped this way — the derived addresses, the
-- single sealed document, what it deliberately does not hold — is in
-- `docs/adr/003 School Storage Profiles.md`.

CREATE TABLE "storage_profiles" (
  "id"            uuid NOT NULL DEFAULT uuid_generate_v4(),

  -- Null for the installation's own bucket, lent to every school that brought
  -- no keys of its own under its `school/<id>` prefix.
  "schoolId"      uuid,

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

-- Lookups over a school's retired profiles, which the partial index below does
-- not cover: an old file is read through the profile that wrote it.
CREATE INDEX "IDX_storage_profiles_school" ON "storage_profiles" ("schoolId");

-- A school has one live profile at a time, and the database is what says so:
-- two grants asking at once must not lend the same school two buckets.
CREATE UNIQUE INDEX "UQ_storage_profiles_live_per_school"
  ON "storage_profiles" ("schoolId")
  WHERE "retiredAt" IS NULL;

-- And the installation has one, which needs an index of its own: nulls are
-- distinct to the index above, so it would permit any number of these rows.
CREATE UNIQUE INDEX "UQ_storage_profiles_live_installation"
  ON "storage_profiles" (("schoolId" IS NULL))
  WHERE "schoolId" IS NULL AND "retiredAt" IS NULL;

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
