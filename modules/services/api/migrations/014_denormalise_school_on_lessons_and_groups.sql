-- Every scoped query filters by school. Reaching the school through the course
-- would make the join the slowest part of the most common query in the system,
-- so the tenant key lives on every table that is scoped by it — as it already
-- does on courses, enrollments, homework and block_states.

ALTER TABLE "groups" ADD COLUMN "schoolId" uuid;
UPDATE "groups" SET "schoolId" = "courses"."schoolId"
  FROM "courses" WHERE "courses"."id" = "groups"."courseId";
ALTER TABLE "groups" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "groups" ADD CONSTRAINT "FK_groups_school"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE;

ALTER TABLE "lessons" ADD COLUMN "schoolId" uuid;
UPDATE "lessons" SET "schoolId" = "courses"."schoolId"
  FROM "courses" WHERE "courses"."id" = "lessons"."courseId";
ALTER TABLE "lessons" ALTER COLUMN "schoolId" SET NOT NULL;
ALTER TABLE "lessons" ADD CONSTRAINT "FK_lessons_school"
  FOREIGN KEY ("schoolId") REFERENCES "schools"("id") ON DELETE CASCADE;
