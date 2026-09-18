-- One row per (enrollment, lesson version, section). The status is owned by the
-- server: a client may submit, but only the server moves a row to returned or
-- accepted, so the two sides never write the same field.
--
-- schoolId is denormalised here because these rows sync to devices and the sync
-- engine filters by school. Adding it later would mean migrating databases that
-- already sit on users' phones.

CREATE TABLE "homework" (
  "id"              uuid NOT NULL DEFAULT uuid_generate_v4(),
  "enrollmentId"    uuid NOT NULL,
  "lessonVersionId" uuid NOT NULL,
  "sectionId"       uuid NOT NULL,
  "schoolId"        uuid NOT NULL,
  "status"          character varying NOT NULL DEFAULT 'open',
  "text"            text NOT NULL DEFAULT '',
  "grade"           integer,
  "reviewedById"    uuid,
  "submittedAt"     TIMESTAMPTZ,
  "reviewedAt"      TIMESTAMPTZ,
  "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "PK_homework" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_homework_enrollment_version_section"
    UNIQUE ("enrollmentId", "lessonVersionId", "sectionId"),
  CONSTRAINT "CK_homework_status"
    CHECK ("status" IN ('open', 'pending', 'in_review', 'returned', 'accepted'))
);

ALTER TABLE "homework" ADD CONSTRAINT "FK_homework_enrollment"
  FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE;
ALTER TABLE "homework" ADD CONSTRAINT "FK_homework_lesson_version"
  FOREIGN KEY ("lessonVersionId") REFERENCES "lesson_versions"("id") ON DELETE RESTRICT;
ALTER TABLE "homework" ADD CONSTRAINT "FK_homework_school"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE;
ALTER TABLE "homework" ADD CONSTRAINT "FK_homework_reviewer"
  FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL;
