-- Per-block progress: how far a video was watched, which answer a quiz got.
-- Written on the device and pushed up, so it carries schoolId like homework.

CREATE TABLE "block_states" (
  "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
  "enrollmentId"    uuid NOT NULL,
  "lessonVersionId" uuid NOT NULL,
  "blockId"         uuid NOT NULL,
  "schoolId"        uuid NOT NULL,
  "state"           json NOT NULL DEFAULT '{}',
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "PK_block_states" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_block_states_enrollment_version_block"
    UNIQUE ("enrollmentId", "lessonVersionId", "blockId")
);

ALTER TABLE "block_states" ADD CONSTRAINT "FK_block_states_enrollment"
  FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE;
ALTER TABLE "block_states" ADD CONSTRAINT "FK_block_states_lesson_version"
  FOREIGN KEY ("lessonVersionId") REFERENCES "lesson_versions"("id") ON DELETE RESTRICT;
ALTER TABLE "block_states" ADD CONSTRAINT "FK_block_states_school"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE;
