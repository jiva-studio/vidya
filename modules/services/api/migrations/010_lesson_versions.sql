-- Lesson content moves out of the lesson row and into immutable versions.
-- Homework references the version it was answered against, so an edit made
-- after a student answered can never change the question they were shown.

CREATE TABLE "lesson_versions" (
  "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
  "lessonId"    uuid NOT NULL,
  "version"     integer NOT NULL,
  "content"     json NOT NULL DEFAULT '{"sections":[]}',
  "status"      character varying NOT NULL DEFAULT 'draft',
  "publishedAt" TIMESTAMPTZ,
  "createdAt"   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "PK_lesson_versions" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_lesson_versions_lesson_version" UNIQUE ("lessonId", "version"),
  CONSTRAINT "CK_lesson_versions_status" CHECK ("status" IN ('draft', 'published'))
);

ALTER TABLE "lesson_versions"
  ADD CONSTRAINT "FK_lesson_versions_lesson"
  FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE;

ALTER TABLE "lessons" DROP COLUMN "content";
