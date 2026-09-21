-- Which files a lesson version points at.
--
-- The table is the answer to "may this file be deleted", so it is written by
-- the same transaction that writes the version's content: a row that outlived
-- its block would keep a file undeletable forever, and a row lost while the
-- content was stored would let a published lesson lose its illustration.
--
-- One row per file per version, however many blocks show it: the question ever
-- asked of this table is whether anything still points at a file, and counting
-- blocks would answer a question nobody has.
--
-- "mediaId" is RESTRICT rather than CASCADE: the row exists to refuse the
-- delete, so the database has to refuse one the application forgot to check.
-- "lessonVersionId" is CASCADE because a version that is gone points at
-- nothing. "schoolId" is copied from the lesson rather than reached through it,
-- so the lessons naming a file can be listed without trusting a join to stay
-- correct across a lesson that moved course.

CREATE TABLE "media_usages" (
  "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
  "mediaId"          uuid NOT NULL,
  "lessonVersionId"  uuid NOT NULL,
  "schoolId"         uuid NOT NULL,
  "createdAt"        TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "PK_media_usages" PRIMARY KEY ("id"),
  CONSTRAINT "FK_media_usages_media" FOREIGN KEY ("mediaId")
    REFERENCES "media" ("id") ON DELETE RESTRICT,
  CONSTRAINT "FK_media_usages_lesson_version" FOREIGN KEY ("lessonVersionId")
    REFERENCES "lesson_versions" ("id") ON DELETE CASCADE
);

-- Deleting a file asks which versions hold it; saving a version asks what it
-- held a moment ago. Both directions are looked up on every write, so both
-- carry an index.
CREATE INDEX "idx_media_usages_mediaId" ON "media_usages" ("mediaId");
CREATE INDEX "idx_media_usages_lessonVersionId" ON "media_usages" ("lessonVersionId");

-- Declared after the plain indexes above and must stay there: the in-memory
-- database the suites run on matches an index by its columns alone, so an index
-- placed first answers lookups it was never meant to serve.
CREATE UNIQUE INDEX "UQ_media_usages_media_version"
  ON "media_usages" ("mediaId", "lessonVersionId");
