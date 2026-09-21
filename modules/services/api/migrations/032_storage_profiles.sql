-- A school's own storage, and the credentials that reach it.
--
-- A profile is never edited in place. Rotating a key or changing provider
-- writes a new row, retires the old one and repoints the school; files already
-- uploaded keep naming the profile that wrote them, so their keys stay
-- readable. "schools"."currentStorageProfileId" is therefore the only thing
-- that moves, and a retired row is kept for as long as one file refers to it.
--
-- The secret is never stored as it was typed. Each row carries its own data
-- key, sealed under the installation's master key ("keyVersion" says which),
-- and the secret is sealed under that data key with the school and the profile
-- as additional data — a ciphertext copied into another row stops decrypting.
-- "accessKeyId" stays in the clear on purpose: it names the credential without
-- being one, and every refusal has to be explainable without the secret.
--
-- "usedBytes" is counted per profile rather than per school because the bytes
-- live in the profile: a school that moves to another bucket starts its count
-- again, and the retired row keeps the count of what it still holds.

CREATE TABLE "storage_profiles" (
  "id"                     uuid NOT NULL DEFAULT uuid_generate_v4(),
  "schoolId"               uuid,
  "kind"                   character varying NOT NULL DEFAULT 's3',
  "endpoint"               character varying NOT NULL,
  "region"                 character varying NOT NULL DEFAULT '',
  "bucket"                 character varying NOT NULL,
  "prefix"                 character varying NOT NULL DEFAULT '',
  "accessKeyId"            character varying NOT NULL,
  "secretCiphertext"       bytea,
  "secretNonce"            bytea,
  "keyVersion"             integer NOT NULL DEFAULT 1,
  "dekCiphertext"          bytea,
  "dekNonce"               bytea,
  "delivery"               character varying NOT NULL DEFAULT 'presigned',
  "publicBaseUrl"          character varying,
  "tokenSecretCiphertext"  bytea,
  "tokenSecretNonce"       bytea,
  "video"                  json NOT NULL DEFAULT '{"kind":"none"}',
  "quotaBytes"             bigint,
  "usedBytes"              bigint NOT NULL DEFAULT 0,
  "verifiedAt"             TIMESTAMPTZ,
  "verifyError"            character varying,
  "retiredAt"              TIMESTAMPTZ,
  "createdAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "PK_storage_profiles" PRIMARY KEY ("id"),
  CONSTRAINT "FK_storage_profiles_school" FOREIGN KEY ("schoolId")
    REFERENCES "schools" ("id") ON DELETE CASCADE
);

-- Every profile a school has ever had, retired ones included: a file is read
-- through the profile that wrote it, so the retired rows are looked up as often
-- as the live one.
--
-- It is declared before the partial unique index below and must stay there. The
-- in-memory database the suites run on picks the first index whose columns
-- match and does not read the predicate, so with the partial one first a lookup
-- by school answers with the live profile alone and the retired ones vanish.
CREATE INDEX "idx_storage_profiles_schoolId" ON "storage_profiles" ("schoolId");

-- A school has at most one profile in use; the retired ones are history.
CREATE UNIQUE INDEX "UQ_storage_profiles_live_school"
  ON "storage_profiles" ("schoolId")
  WHERE "retiredAt" IS NULL;

ALTER TABLE "schools"
  ADD COLUMN "currentStorageProfileId" uuid;

-- SET NULL rather than CASCADE: losing the profile row must drop the school
-- back to the storage of the installation, not delete the school.
ALTER TABLE "schools"
  ADD CONSTRAINT "FK_schools_currentStorageProfile"
  FOREIGN KEY ("currentStorageProfileId")
  REFERENCES "storage_profiles" ("id") ON DELETE SET NULL;
