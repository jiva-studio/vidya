-- A student enrols on a COURSE. The group is assigned later, which is why
-- groupId is nullable: a student can be accepted and wait in the queue until a
-- suitable group exists.

CREATE TABLE "enrollments" (
  "id"           uuid NOT NULL DEFAULT uuid_generate_v4(),
  "courseId"     uuid NOT NULL,
  "groupId"      uuid,
  "studentId"    uuid NOT NULL,
  "schoolId"     uuid NOT NULL,
  "status"       character varying NOT NULL DEFAULT 'pending',
  "decidedById"  uuid,
  "decidedAt"    TIMESTAMPTZ,
  "createdAt"    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT "PK_enrollments" PRIMARY KEY ("id"),
  CONSTRAINT "UQ_enrollments_course_student" UNIQUE ("courseId", "studentId"),
  CONSTRAINT "CK_enrollments_status" CHECK ("status" IN ('pending', 'accepted', 'declined'))
);

ALTER TABLE "enrollments" ADD CONSTRAINT "FK_enrollments_course"
  FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "FK_enrollments_group"
  FOREIGN KEY ("groupId") REFERENCES "groups"("id") ON DELETE SET NULL;
ALTER TABLE "enrollments" ADD CONSTRAINT "FK_enrollments_student"
  FOREIGN KEY ("studentId") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "enrollments" ADD CONSTRAINT "FK_enrollments_school"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE;
