-- An uploaded file, from the moment it is promised to the moment it is served.
--
-- The row exists before the bytes do: its id is part of the object key, so it
-- has to be handed out before an upload can be signed. A row that never
-- received its bytes stays "pending" and is cleared away with its object by the
-- sweep; "failed" is kept rather than deleted so a refused upload can be told
-- apart from one that was never started.
--
-- "sizeBytes" holds what the client declared while the row is pending — that is
-- what the quota reserves against — and is overwritten with what storage
-- reports when the row turns ready. The declared number is never trusted for
-- anything else.
--
-- "profileId" is RESTRICT rather than CASCADE: the profile carries the keys the
-- object is read through, so dropping it while a file names it would leave
-- bytes nobody can reach.

CREATE TABLE "media" (
  "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
  "schoolId"       uuid NOT NULL,
  "profileId"      uuid NOT NULL,
  "kind"           character varying NOT NULL,
  "status"         character varying NOT NULL DEFAULT 'pending',
  "storageKey"     character varying NOT NULL,
  "externalId"     character varying,
  "name"           character varying NOT NULL,
  "mimeType"       character varying NOT NULL,
  "sizeBytes"      bigint NOT NULL DEFAULT 0,

  -- The digest travels base64 rather than hex, so 64 is a ceiling with room to
  -- spare rather than the exact width of a SHA-256.
  "sha256"         character varying(64),

  "width"          integer,
  "height"         integer,
  "durationMs"     integer,
  "posterMediaId"  uuid,
  "createdBy"      uuid NOT NULL,
  "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMPTZ NOT NULL DEFAULT now(),
  "archivedAt"     TIMESTAMPTZ,
  CONSTRAINT "PK_media" PRIMARY KEY ("id"),
  CONSTRAINT "FK_media_school" FOREIGN KEY ("schoolId")
    REFERENCES "schools" ("id") ON DELETE CASCADE,
  CONSTRAINT "FK_media_storage_profile" FOREIGN KEY ("profileId")
    REFERENCES "storage_profiles" ("id") ON DELETE RESTRICT
);

-- The gallery: one school's files of one kind, newest first.
CREATE INDEX "idx_media_school_kind_createdAt" ON "media" ("schoolId", "kind", "createdAt" DESC);

-- The sweep: the pending rows old enough to give up on.
CREATE INDEX "idx_media_status_createdAt" ON "media" ("status", "createdAt");

-- Deduplication is inside a school and never across two: the same bytes
-- uploaded by another school get their own row, because sharing one would make
-- one school's file readable through the other's library.
--
-- It is declared after the plain indexes above and must stay there: the
-- in-memory database the suites run on matches an index by its columns without
-- reading its predicate, so a partial index placed first answers a query with
-- the rows it happens to hold.
CREATE UNIQUE INDEX "UQ_media_school_sha256_ready"
  ON "media" ("schoolId", "sha256")
  WHERE "status" = 'ready' AND "sha256" IS NOT NULL;
