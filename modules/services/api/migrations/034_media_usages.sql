-- Which files a lesson version points at, so a deletion can be refused with one
-- lookup. How it is written, why the two foreign keys differ, and what a
-- deletion does with it: docs/Media Usage Tracking.md

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
